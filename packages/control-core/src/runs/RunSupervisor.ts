import {
  run as sandcastleRun,
  codex,
  claudeCode,
  createBindMountSandboxProvider,
  opencode,
  pi,
  type AgentProvider,
  type SandboxProvider,
} from "@ai-hero/sandcastle";
import type {
  PostRunDecisionResponse,
  PostQuestForgeEngageRequest,
  PostRunsRequest,
  Phase,
  Run,
  RunEvent,
} from "@sandcastle/protocol";
import type { OperativeIdentity } from "@sandcastle/protocol";
import { ActivityFeed } from "../activity/ActivityFeed.js";
import { DecisionActions } from "../decisions/DecisionActions.js";
import { FleetBudgetService } from "../fleet/FleetBudgetService.js";
import type { OperativeStore } from "../operatives/OperativeStore.js";
import { RunEventProjector } from "./RunEventProjector.js";
import {
  RepoRunCoordinator,
  type CoordinatedRunStrategy,
} from "./RepoRunCoordinator.js";
import type { SqliteStore } from "../telemetry/SqliteStore.js";
import { XpLedger } from "../xp/XpLedger.js";
import { PhasedRunOrchestrator } from "../quest-forge/PhasedRunOrchestrator.js";
import { QuestForgeParser } from "../quest-forge/QuestForgeParser.js";
import { spawn, type StdioOptions } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";

export type EngineAgentStreamEvent = RunEvent;

type RunImpl = typeof sandcastleRun;

type Subscriber = (runId: string, event: RunEvent) => void;

export interface RunSupervisorOptions {
  readonly repoRoot: string;
  readonly store: SqliteStore;
  readonly runImpl?: RunImpl;
  readonly agentFactory?: (request: PostRunsRequest) => AgentProvider;
  readonly sandboxFactory?: () => SandboxProvider;
  readonly coordinator?: RepoRunCoordinator;
  readonly budgetService?: FleetBudgetService;
  readonly operativeStore?: Pick<OperativeStore, "getIdentity">;
}

const toProvider = (request: PostRunsRequest): AgentProvider => {
  const model =
    request.model ?? process.env.SANDCASTLE_CONTROL_MODEL ?? "gpt-5.4";
  switch (request.provider ?? "codex") {
    case "claude-code":
      return claudeCode(model, { captureSessions: false });
    case "pi":
      return pi(model);
    case "opencode":
      return opencode(model);
    case "codex":
      return codex(model);
  }
};

const hostSandbox = (): SandboxProvider =>
  createBindMountSandboxProvider({
    name: "host-bind-mount",
    create: async (createOptions) => ({
      worktreePath: createOptions.worktreePath,
      exec: (command, opts) =>
        new Promise((resolveExec, reject) => {
          const proc = spawn(
            process.platform === "win32" ? "cmd.exe" : "sh",
            process.platform === "win32"
              ? ["/d", "/s", "/c", command]
              : ["-c", command],
            {
              cwd: opts?.cwd ?? createOptions.worktreePath,
              env: { ...process.env, ...createOptions.env },
              stdio: [
                opts?.stdin !== undefined ? "pipe" : "ignore",
                "pipe",
                "pipe",
              ],
            },
          );
          if (opts?.stdin !== undefined) {
            proc.stdin?.write(opts.stdin);
            proc.stdin?.end();
          }
          const stdoutChunks: string[] = [];
          const stderrChunks: string[] = [];
          if (opts?.onLine) {
            const rl = createInterface({ input: proc.stdout! });
            rl.on("line", (line) => {
              stdoutChunks.push(line);
              opts.onLine?.(line);
            });
          } else {
            proc.stdout?.on("data", (chunk: Buffer) =>
              stdoutChunks.push(chunk.toString()),
            );
          }
          proc.stderr?.on("data", (chunk: Buffer) =>
            stderrChunks.push(chunk.toString()),
          );
          proc.on("error", reject);
          proc.on("close", (code) =>
            resolveExec({
              stdout: stdoutChunks.join(opts?.onLine ? "\n" : ""),
              stderr: stderrChunks.join(""),
              exitCode: code ?? 0,
            }),
          );
        }),
      interactiveExec: (args, opts) =>
        new Promise((resolveExec, reject) => {
          const [cmd, ...rest] = args;
          const proc = spawn(cmd!, rest, {
            cwd: opts.cwd ?? createOptions.worktreePath,
            env: { ...process.env, ...createOptions.env },
            stdio: [opts.stdin, opts.stdout, opts.stderr] as StdioOptions,
          });
          proc.on("error", reject);
          proc.on("close", (code) => resolveExec({ exitCode: code ?? 0 }));
        }),
      copyFileIn: async () => {},
      copyFileOut: async () => {},
      close: async () => {},
    }),
  });

export class RunSupervisor {
  private readonly projector = new RunEventProjector();
  private readonly subscribers = new Set<Subscriber>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly runImpl: RunImpl;
  private readonly agentFactory: (request: PostRunsRequest) => AgentProvider;
  private readonly sandboxFactory: () => SandboxProvider;
  private readonly coordinator: RepoRunCoordinator;
  private readonly budgetService: FleetBudgetService;
  private readonly activityFeed: ActivityFeed;
  private readonly xpLedger: XpLedger;

  constructor(private readonly options: RunSupervisorOptions) {
    this.runImpl = options.runImpl ?? sandcastleRun;
    this.agentFactory = options.agentFactory ?? toProvider;
    this.sandboxFactory = options.sandboxFactory ?? hostSandbox;
    this.coordinator = options.coordinator ?? new RepoRunCoordinator();
    this.budgetService = options.budgetService ?? new FleetBudgetService();
    this.activityFeed = new ActivityFeed(options.store);
    this.xpLedger = new XpLedger(options.store);
    for (const run of options.store.listRuns()) {
      this.projector.createQueued({
        id: run.id,
        directive: run.directive,
        branch: run.branch,
        worktreePath: run.worktreePath,
        operativeId: run.operativeId,
        provider: run.provider,
        sandboxProvider: run.sandboxProvider,
        startedAt: run.startedAt,
      });
    }
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  listRuns(): Run[] {
    const projected = this.projector.listRuns();
    const stored = this.options.store.listRuns();
    const byId = new Map(stored.map((run) => [run.id, run]));
    for (const run of projected) byId.set(run.id, run);
    return [...byId.values()];
  }

  listPhases(): Phase[] {
    return this.projector.listPhases();
  }

  getRun(id: string): Run | undefined {
    return this.projector.getRun(id) ?? this.options.store.getRun(id);
  }

  async startRun(request: PostRunsRequest): Promise<{ runId: string }> {
    const operativeId = request.operativeId ?? "pi-default";
    const operative = this.getOperative(operativeId);
    this.budgetService.assertCanStart({
      operative,
      repoRoot: this.options.repoRoot,
      activeRuns: this.listRuns().map((run) => ({
        id: run.id,
        operativeId: run.operativeId,
        repoRoot: this.options.repoRoot,
        status: run.status,
      })),
    });

    const targetBranch = await currentBranch(this.options.repoRoot).catch(
      () => "unknown",
    );
    const prepared = this.coordinator.prepareRun({
      repoRoot: this.options.repoRoot,
      targetBranch,
      strategy: toCoordinatedStrategy(request),
    });
    const runId = prepared.runId;
    const worktreePath =
      prepared.engineBranchStrategy.type === "head"
        ? undefined
        : join(
            this.options.repoRoot,
            ".sandcastle",
            "worktrees",
            prepared.branch.replace(/\//g, "-"),
          );
    const queued = this.projector.createQueued({
      id: runId,
      directive: request.directive,
      branch: prepared.branch,
      worktreePath,
      operativeId,
      provider: request.provider,
      sandboxProvider: "host-bind-mount",
    });
    this.options.store.upsertRun(queued);
    this.handleEvent(runId, {
      type: "run.started",
      runId,
      directive: request.directive,
      branch: prepared.branch,
      worktreePath,
      iteration: 0,
      timestamp: new Date(queued.startedAt),
    });

    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const agent = this.agentFactory(request);
    const sandbox = this.sandboxFactory();

    void Promise.resolve()
      .then(() =>
        this.runImpl({
          cwd: this.options.repoRoot,
          agent,
          sandbox,
          prompt: request.directive,
          maxIterations: request.maxIterations,
          completionSignal: request.completionSignal,
          branchStrategy: prepared.engineBranchStrategy,
          name: runId,
          signal: controller.signal,
          logging: {
            type: "file",
            path: `${this.options.repoRoot}/.sandcastle/logs/${runId}.log`,
            onAgentStreamEvent: (event: unknown) =>
              this.handleEngineEvent(runId, event as EngineAgentStreamEvent),
          },
        }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        this.handleEvent(runId, {
          type: "run.resolved",
          runId,
          result: "defeat",
          xpDelta: 0,
          iteration: 0,
          timestamp: new Date(),
        });
        console.error("[sandcastle-control] run failed", error);
      })
      .finally(() => {
        prepared.release();
        this.controllers.delete(runId);
      });

    return { runId };
  }

  async startPhasedRun(
    request: PostQuestForgeEngageRequest,
  ): Promise<{ runId: string }> {
    const phases =
      request.phases ?? new QuestForgeParser().parse(request.directive);
    if (phases.length === 0) {
      throw new Error("QuestForge engage requires at least one phase");
    }

    const operativeId = request.operativeId ?? "pi-default";
    const operative = this.getOperative(operativeId);
    this.budgetService.assertCanStart({
      operative,
      repoRoot: this.options.repoRoot,
      activeRuns: this.listRuns().map((run) => ({
        id: run.id,
        operativeId: run.operativeId,
        repoRoot: this.options.repoRoot,
        status: run.status,
      })),
    });

    const targetBranch = await currentBranch(this.options.repoRoot).catch(
      () => "unknown",
    );
    const prepared = this.coordinator.prepareRun({
      repoRoot: this.options.repoRoot,
      targetBranch,
      strategy: toCoordinatedStrategy(request),
    });
    const runId = prepared.runId;
    const worktreePath =
      prepared.engineBranchStrategy.type === "head"
        ? undefined
        : join(
            this.options.repoRoot,
            ".sandcastle",
            "worktrees",
            prepared.branch.replace(/\//g, "-"),
          );
    const queued = this.projector.createQueued({
      id: runId,
      directive: request.directive,
      branch: prepared.branch,
      worktreePath,
      operativeId,
      provider: request.provider,
      sandboxProvider: "host-bind-mount",
      phaseIds: phases.map((phase) => phase.id),
    });
    this.options.store.upsertRun(queued);
    this.handleEvent(runId, {
      type: "run.started",
      runId,
      directive: request.directive,
      branch: prepared.branch,
      worktreePath,
      iteration: 0,
      timestamp: new Date(queued.startedAt),
    });

    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const orchestrator = new PhasedRunOrchestrator({
      repoRoot: this.options.repoRoot,
      runImpl: this.runImpl,
      agent: this.agentFactory(request),
      sandbox: this.sandboxFactory(),
      prepared,
      worktreePath,
      maxIterations: request.maxIterations,
      completionSignal: request.completionSignal,
      signal: controller.signal,
      emitEvent: (id, event) => this.handleEvent(id, event),
    });

    void orchestrator
      .run({ runId, directive: request.directive, phases })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        this.handleEvent(runId, {
          type: "run.resolved",
          runId,
          result: "defeat",
          xpDelta: 0,
          iteration: 0,
          timestamp: new Date(),
        });
        console.error("[sandcastle-control] phased run failed", error);
      })
      .finally(() => {
        prepared.release();
        this.controllers.delete(runId);
      });

    return { runId };
  }

  cancelRun(runId: string): boolean {
    const controller = this.controllers.get(runId);
    if (!controller) return false;
    this.handleEvent(runId, {
      type: "intervention.used",
      action: "cancel",
      iteration: 0,
      timestamp: new Date(),
    });
    controller.abort(new DOMException("Run cancelled", "AbortError"));
    this.handleEvent(runId, {
      type: "run.resolved",
      runId,
      result: "aborted",
      xpDelta: 0,
      iteration: 0,
      timestamp: new Date(),
    });
    return true;
  }

  async decideRun(
    runId: string,
    request: { readonly kind: "merge" | "revise" | "discard" },
  ): Promise<PostRunDecisionResponse | undefined> {
    return this.decisionActions().decide(runId, request);
  }

  async mergeAllGreen(): Promise<{
    readonly results: Array<{
      readonly runId: string;
      readonly ok: boolean;
      readonly action: "merge";
      readonly message?: string;
    }>;
    readonly aborted: boolean;
  }> {
    const results: Array<{
      readonly runId: string;
      readonly ok: boolean;
      readonly action: "merge";
      readonly message?: string;
    }> = [];

    for (const run of this.listRuns().filter(
      (candidate) => candidate.status === "win-pending",
    )) {
      const result = await this.decisionActions().decide(run.id, {
        kind: "merge",
      });
      if (!result) continue;
      results.push({
        runId: result.runId,
        ok: result.ok,
        action: "merge",
        message: result.message,
      });
      if (!result.ok) return { results, aborted: true };
    }

    return { results, aborted: false };
  }

  private handleEngineEvent(
    runId: string,
    event: EngineAgentStreamEvent,
  ): void {
    if (event.type === "run.resolved" && event.result === "victory") {
      this.handleEvent(runId, {
        type: "verification.finished",
        allGreen: true,
        failedChecks: [],
        iteration: event.iteration,
        timestamp: event.timestamp,
      });
      return;
    }
    if (event.type === "run.resolved" && event.result === "defeat") {
      this.handleEvent(runId, {
        type: "verification.finished",
        allGreen: false,
        failedChecks: ["completion-signal"],
        iteration: event.iteration,
        timestamp: event.timestamp,
      });
      return;
    }
    this.handleEvent(runId, normalizeRunId(runId, event));
  }

  private handleEvent(runId: string, event: RunEvent): void {
    const run = this.projector.project(event, runId);
    if (run) {
      this.options.store.upsertRun(run);
      this.activityFeed.recordRunEvent(this.options.repoRoot, run, event);
    }
    this.options.store.appendEvent(runId, event);
    for (const subscriber of this.subscribers) subscriber(runId, event);
  }

  private decisionActions(): DecisionActions {
    return new DecisionActions({
      repoRoot: this.options.repoRoot,
      coordinator: this.coordinator,
      getRun: (runId) => this.getRun(runId),
      emitEvent: (runId, event) => this.handleEvent(runId, event),
      targetBranch: () => currentBranch(this.options.repoRoot),
      xpLedger: this.xpLedger,
    });
  }

  private getOperative(operativeId: string): OperativeIdentity {
    const identity = this.options.operativeStore?.getIdentity(operativeId);
    if (identity) return identity;
    return {
      id: operativeId,
      codename: operativeId,
      provider: "codex",
      model: "gpt-5.4",
      species: "synthetic",
      className: "Builder",
      level: 1,
      globalXp: 0,
      bond: 0,
      streak: 0,
      concurrencyCap: 5,
      sleeveCardIds: [],
      unlockedTraits: [],
    };
  }
}

const toCoordinatedStrategy = (
  request: PostRunsRequest,
): CoordinatedRunStrategy => {
  const strategy = request.branchStrategy ?? { type: "merge-to-head" as const };
  switch (strategy.type) {
    case "head":
      return { type: "head" };
    case "branch":
      return {
        type: "branch",
        branch: strategy.branch,
        baseBranch: strategy.baseBranch,
      };
    case "merge-to-head":
      return { type: "merge-to-head", name: strategy.name };
  }
};

const normalizeRunId = (runId: string, event: RunEvent): RunEvent => {
  if ("runId" in event && event.runId === runId) return event;
  if ("runId" in event) return { ...event, runId } as RunEvent;
  return event;
};

const currentBranch = async (cwd: string): Promise<string> => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd },
  );
  return stdout.trim();
};
