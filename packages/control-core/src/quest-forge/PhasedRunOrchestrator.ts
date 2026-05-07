import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  run as sandcastleRun,
  type AgentProvider,
  type SandboxProvider,
} from "@ai-hero/sandcastle";
import type {
  ParsedPhase,
  Phase,
  RunEvent,
  VerifyRuleResult,
} from "@sandcastle/protocol";
import type { PreparedRun } from "../runs/RepoRunCoordinator.js";
import { cleanupProviderPaths } from "../adapters/materialize.js";
import { describeVerifyRule } from "./VerifyRule.js";
import { VerifyRuleExecutor } from "./VerifyRuleExecutor.js";

type RunImpl = typeof sandcastleRun;
type EmitEvent = (runId: string, event: RunEvent) => void;
type ExecutorFactory = (input: {
  readonly worktreePath: string;
  readonly baseCommit: string;
}) => Pick<VerifyRuleExecutor, "execute">;

export interface PhasedRunOrchestratorOptions {
  readonly repoRoot: string;
  readonly runImpl: RunImpl;
  readonly agent: AgentProvider;
  readonly sandbox: SandboxProvider;
  readonly prepared: PreparedRun;
  readonly worktreePath?: string;
  readonly maxIterations?: number;
  readonly completionSignal?: string | readonly string[];
  readonly signal: AbortSignal;
  readonly emitEvent: EmitEvent;
  readonly executorFactory?: ExecutorFactory;
  readonly providerCleanupPaths?: readonly string[];
}

export class PhasedRunOrchestrator {
  constructor(private readonly options: PhasedRunOrchestratorOptions) {}

  async run(input: {
    readonly runId: string;
    readonly directive: string;
    readonly phases: readonly ParsedPhase[];
  }): Promise<void> {
    const runId = input.runId;
    try {
      let phaseIndex = 0;
      for (const parsed of input.phases) {
        this.options.signal.throwIfAborted();
        const phase = toRuntimePhase(runId, parsed, "active");
        this.emit({
          type: "phase.started",
          runId,
          phaseId: phase.id,
          phase,
          iteration: 0,
          timestamp: new Date(),
        });

        const phaseWorktreeBefore = this.currentWorktreeOrRepo();
        const baseCommit = await revParse(phaseWorktreeBefore, "HEAD");
        let engineSucceeded = false;

        try {
          const completionSignal = normalizeCompletionSignal(
            this.options.completionSignal,
          );
          // Phase 1 creates the worktree from the configured strategy.
          // Phase 2+ runs inside the already-created worktree as if it
          // were the main checkout (head strategy), so the engine doesn't
          // try to re-create a worktree on the existing branch.
          const isFirstPhase = phaseIndex === 0;
          const phaseCwd =
            !isFirstPhase && this.options.worktreePath
              ? this.options.worktreePath
              : this.options.repoRoot;
          const phaseStrategy = isFirstPhase
            ? this.options.prepared.engineBranchStrategy
            : ({ type: "head" } as const);
          const result = await this.options.runImpl({
            cwd: phaseCwd,
            agent: this.options.agent,
            sandbox: this.options.sandbox,
            prompt: parsed.directiveSlice,
            maxIterations: this.options.maxIterations,
            completionSignal,
            branchStrategy: phaseStrategy,
            name: runId,
            signal: this.options.signal,
            logging: {
              type: "file",
              path: `${this.options.repoRoot}/.sandcastle/logs/${runId}-${phase.id}.log`,
              onAgentStreamEvent: (event: unknown) => {
                const normalized = normalizeRunId(runId, event as RunEvent);
                if (normalized.type === "run.started") return;
                if (normalized.type === "run.resolved") {
                  engineSucceeded = normalized.result === "victory";
                  return;
                }
                this.options.emitEvent(runId, normalized);
              },
            },
          });
          engineSucceeded =
            engineSucceeded || result.completionSignal !== undefined;
          phaseIndex += 1;
        } catch (error) {
          if (this.options.signal.aborted) throw error;
          this.emitFailed(runId, phase.id, [
            failedResult(
              parsed,
              error instanceof Error ? error.message : String(error),
            ),
          ]);
          return;
        }

        if (!engineSucceeded) {
          this.emitFailed(runId, phase.id, [
            failedResult(parsed, "completion-signal"),
          ]);
          return;
        }

        const verifyWorktree = await this.ensureWorktree();
        this.emit({
          type: "phase.verifying",
          runId,
          phaseId: phase.id,
          rules: parsed.verifyRules,
          iteration: 0,
          timestamp: new Date(),
        });
        const executor =
          this.options.executorFactory?.({
            worktreePath: verifyWorktree,
            baseCommit,
          }) ??
          new VerifyRuleExecutor({ worktreePath: verifyWorktree, baseCommit });
        const results = await executor.execute(parsed.verifyRules);
        const failed = results.filter((result) => !result.ok);
        if (failed.length > 0) {
          this.emitFailed(runId, phase.id, results);
          return;
        }
        this.emit({
          type: "phase.verified",
          runId,
          phaseId: phase.id,
          results,
          iteration: 0,
          timestamp: new Date(),
        });
      }

      this.emit(
        {
          type: "verification.finished",
          allGreen: true,
          failedChecks: [],
          iteration: 0,
          timestamp: new Date(),
        },
        runId,
      );
    } finally {
      await cleanupProviderPaths(
        this.currentWorktreeOrRepo(),
        this.options.providerCleanupPaths,
      );
    }
  }

  private async ensureWorktree(): Promise<string> {
    const strategy = this.options.prepared.engineBranchStrategy;
    if (strategy.type === "head") {
      return this.options.repoRoot;
    }
    if (!this.options.worktreePath) return this.options.repoRoot;
    if (existsSync(this.options.worktreePath)) return this.options.worktreePath;
    mkdirSync(dirname(this.options.worktreePath), { recursive: true });
    await execFileAsync(
      "git",
      [
        "worktree",
        "add",
        this.options.worktreePath,
        this.options.prepared.branch,
      ],
      { cwd: this.options.repoRoot },
    );
    return this.options.worktreePath;
  }

  private currentWorktreeOrRepo(): string {
    if (this.options.worktreePath && existsSync(this.options.worktreePath)) {
      return this.options.worktreePath;
    }
    return this.options.repoRoot;
  }

  private emitFailed(
    runId: string,
    phaseId: string,
    results: VerifyRuleResult[],
  ): void {
    this.emit({
      type: "phase.failed",
      runId,
      phaseId,
      results,
      iteration: 0,
      timestamp: new Date(),
    });
    this.emit(
      {
        type: "verification.finished",
        allGreen: false,
        failedChecks: results
          .filter((result) => !result.ok)
          .map((result) => describeVerifyRule(result.rule)),
        failedPhaseId: phaseId,
        iteration: 0,
        timestamp: new Date(),
      },
      runId,
    );
  }

  private emit(event: RunEvent, fallbackRunId?: string): void {
    const runId = "runId" in event ? event.runId : fallbackRunId;
    if (!runId) throw new Error(`Cannot emit ${event.type} without runId`);
    this.options.emitEvent(runId, event);
  }
}

const toRuntimePhase = (
  runId: string,
  phase: ParsedPhase,
  status: Phase["status"],
): Phase => ({
  ...phase,
  runId,
  status,
  startedAt: new Date().toISOString(),
  endedAt: null,
});

const failedResult = (
  phase: ParsedPhase,
  output: string,
): VerifyRuleResult => ({
  rule:
    phase.verifyRules[0] ??
    ({ kind: "command", command: "phase completion" } as const),
  ok: false,
  output,
  durationMs: 0,
});

const normalizeRunId = (runId: string, event: RunEvent): RunEvent => {
  if ("runId" in event && event.runId === runId) return event;
  if ("runId" in event) return { ...event, runId } as RunEvent;
  return event;
};

const normalizeCompletionSignal = (
  signal: string | readonly string[] | undefined,
): string | string[] | undefined => {
  if (signal === undefined || typeof signal === "string") return signal;
  return [...signal];
};

const execFileAsync = promisify(execFile);

const revParse = async (cwd: string, ref: string): Promise<string> => {
  const { stdout } = await execFileAsync("git", ["rev-parse", ref], { cwd });
  return stdout.trim();
};
