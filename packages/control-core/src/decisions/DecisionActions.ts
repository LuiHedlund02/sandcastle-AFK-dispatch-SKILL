import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  PostRunDecisionRequest,
  PostRunDecisionResponse,
  Run,
  RunEvent,
} from "@sandcastle/protocol";
import { RepoRunCoordinator } from "../runs/RepoRunCoordinator.js";

const execFileAsync = promisify(execFile);

export interface DecisionActionsOptions {
  readonly repoRoot: string;
  readonly coordinator: RepoRunCoordinator;
  readonly getRun: (runId: string) => Run | undefined;
  readonly emitEvent: (runId: string, event: RunEvent) => void;
  readonly targetBranch?: () => Promise<string>;
  readonly mergeImpl?: (input: {
    readonly run: Run;
    readonly targetBranch: string;
  }) => Promise<void>;
  readonly discardImpl?: (run: Run) => Promise<void>;
}

export class DecisionActions {
  constructor(private readonly options: DecisionActionsOptions) {}

  async decide(
    runId: string,
    request: PostRunDecisionRequest,
  ): Promise<PostRunDecisionResponse | undefined> {
    const run = this.options.getRun(runId);
    if (!run) return undefined;

    switch (request.kind) {
      case "merge":
        return this.merge(run);
      case "discard":
        return this.discard(run);
      case "revise":
        return { runId, kind: "revise", ok: true, message: "No-op in Phase 2" };
    }
  }

  private async merge(run: Run): Promise<PostRunDecisionResponse> {
    const targetBranch =
      this.options.targetBranch !== undefined
        ? await this.options.targetBranch()
        : await currentBranch(this.options.repoRoot);

    try {
      await this.options.coordinator.withMergeMutex(
        this.options.repoRoot,
        targetBranch,
        () =>
          this.options.mergeImpl
            ? this.options.mergeImpl({ run, targetBranch })
            : mergeBranch(this.options.repoRoot, run.branch, targetBranch),
      );
      this.options.emitEvent(run.id, {
        type: "intervention.used",
        action: "merge",
        iteration: 0,
        timestamp: new Date(),
      });
      this.options.emitEvent(run.id, {
        type: "run.resolved",
        runId: run.id,
        result: "victory",
        xpDelta: 0,
        iteration: 0,
        timestamp: new Date(),
      });
      return { runId: run.id, kind: "merge", ok: true };
    } catch (error) {
      return {
        runId: run.id,
        kind: "merge",
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async discard(run: Run): Promise<PostRunDecisionResponse> {
    try {
      if (this.options.discardImpl) {
        await this.options.discardImpl(run);
      } else {
        await discardRun(this.options.repoRoot, run);
      }
      this.options.emitEvent(run.id, {
        type: "intervention.used",
        action: "discard",
        iteration: 0,
        timestamp: new Date(),
      });
      this.options.emitEvent(run.id, {
        type: "run.resolved",
        runId: run.id,
        result: "aborted",
        xpDelta: 0,
        iteration: 0,
        timestamp: new Date(),
      });
      return { runId: run.id, kind: "discard", ok: true };
    } catch (error) {
      return {
        runId: run.id,
        kind: "discard",
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

const currentBranch = async (repoRoot: string): Promise<string> => {
  const { stdout } = await execFileAsync(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd: repoRoot },
  );
  return stdout.trim();
};

const mergeBranch = async (
  repoRoot: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<void> => {
  const current = await currentBranch(repoRoot);
  if (current !== targetBranch) {
    await execFileAsync("git", ["checkout", targetBranch], { cwd: repoRoot });
  }
  await execFileAsync("git", ["merge", "--no-edit", sourceBranch], {
    cwd: repoRoot,
  });
  if (sourceBranch !== targetBranch) {
    await execFileAsync("git", ["branch", "-D", sourceBranch], {
      cwd: repoRoot,
    }).catch(() => undefined);
  }
};

const discardRun = async (repoRoot: string, run: Run): Promise<void> => {
  const worktreePath =
    run.worktreePath ??
    join(repoRoot, ".sandcastle", "worktrees", run.branch.replace(/\//g, "-"));
  if (existsSync(worktreePath)) {
    await execFileAsync(
      "git",
      ["worktree", "remove", "--force", worktreePath],
      {
        cwd: repoRoot,
      },
    ).catch(() => undefined);
  }

  const current = await currentBranch(repoRoot).catch(() => undefined);
  if (run.branch !== current) {
    await execFileAsync("git", ["branch", "-D", run.branch], {
      cwd: repoRoot,
    }).catch(() => undefined);
  }
};
