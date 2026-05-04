import type { BranchStrategy } from "@ai-hero/sandcastle";
import { allocateRunId } from "./RunIdAllocator.js";

export class HeadStrategyNotParallelError extends Error {
  readonly code = "HEAD_STRATEGY_NOT_PARALLEL";

  constructor(repoRoot: string) {
    super(
      `Head worktree strategy cannot be used while another run is active for ${repoRoot}`,
    );
    this.name = "HeadStrategyNotParallelError";
  }
}

export class BranchModeLockError extends Error {
  readonly code = "BRANCH_MODE_LOCKED";

  constructor(branch: string, repoRoot: string) {
    super(`Branch '${branch}' already has an active run for ${repoRoot}`);
    this.name = "BranchModeLockError";
  }
}

export type CoordinatedRunStrategy =
  | { readonly type: "merge-to-head"; readonly name?: string }
  | {
      readonly type: "branch";
      readonly branch: string;
      readonly baseBranch?: string;
    }
  | { readonly type: "head" };

export interface PreparedRun {
  readonly runId: string;
  readonly branch: string;
  readonly targetBranch: string;
  readonly engineBranchStrategy: BranchStrategy;
  readonly release: () => void;
}

interface RunLease {
  readonly repoRoot: string;
  readonly branchLockKey?: string;
  readonly headMode: boolean;
  released: boolean;
}

class AsyncMutex {
  private inFlight = false;
  private readonly queue: Array<() => void> = [];

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private acquire(): Promise<() => void> {
    if (!this.inFlight) {
      this.inFlight = true;
      return Promise.resolve(this.releaseOnce());
    }
    return new Promise((resolve) => {
      this.queue.push(() => resolve(this.releaseOnce()));
    });
  }

  private releaseOnce(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) {
        next();
        return;
      }
      this.inFlight = false;
    };
  }
}

export class RepoRunCoordinator {
  private readonly activeRunCountsByRepo = new Map<string, number>();
  private readonly activeHeadCountsByRepo = new Map<string, number>();
  private readonly activeBranchLocks = new Set<string>();
  private readonly mergeMutexes = new Map<string, AsyncMutex>();

  prepareRun(input: {
    readonly repoRoot: string;
    readonly targetBranch: string;
    readonly strategy: CoordinatedRunStrategy;
    readonly runId?: string;
  }): PreparedRun {
    const runId = input.runId ?? allocateRunId();
    const activeRuns = this.activeRunCountsByRepo.get(input.repoRoot) ?? 0;
    const activeHeadRuns = this.activeHeadCountsByRepo.get(input.repoRoot) ?? 0;

    if (input.strategy.type === "head" && activeRuns > 0) {
      throw new HeadStrategyNotParallelError(input.repoRoot);
    }
    if (input.strategy.type !== "head" && activeHeadRuns > 0) {
      throw new HeadStrategyNotParallelError(input.repoRoot);
    }

    const branch =
      input.strategy.type === "merge-to-head"
        ? generateRunBranch(runId, input.strategy.name)
        : input.strategy.type === "branch"
          ? input.strategy.branch
          : input.targetBranch;
    const branchLockKey =
      input.strategy.type === "branch"
        ? this.branchLockKey(input.repoRoot, input.strategy.branch)
        : undefined;
    const lockedBranch =
      input.strategy.type === "branch" ? input.strategy.branch : undefined;

    if (branchLockKey && this.activeBranchLocks.has(branchLockKey)) {
      throw new BranchModeLockError(lockedBranch!, input.repoRoot);
    }

    if (branchLockKey) this.activeBranchLocks.add(branchLockKey);
    this.activeRunCountsByRepo.set(input.repoRoot, activeRuns + 1);
    if (input.strategy.type === "head") {
      this.activeHeadCountsByRepo.set(input.repoRoot, activeHeadRuns + 1);
    }

    const lease: RunLease = {
      repoRoot: input.repoRoot,
      branchLockKey,
      headMode: input.strategy.type === "head",
      released: false,
    };

    return {
      runId,
      branch,
      targetBranch: input.targetBranch,
      engineBranchStrategy:
        input.strategy.type === "head"
          ? { type: "head" }
          : input.strategy.type === "branch"
            ? {
                type: "branch",
                branch: input.strategy.branch,
                baseBranch: input.strategy.baseBranch,
              }
            : { type: "branch", branch },
      release: () => this.releaseRun(lease),
    };
  }

  async withRun<T>(
    input: {
      readonly repoRoot: string;
      readonly targetBranch: string;
      readonly strategy: CoordinatedRunStrategy;
      readonly runId?: string;
    },
    operation: (prepared: PreparedRun) => Promise<T>,
  ): Promise<T> {
    const prepared = this.prepareRun(input);
    try {
      return await operation(prepared);
    } finally {
      prepared.release();
    }
  }

  async withMergeMutex<T>(
    repoRoot: string,
    targetBranch: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = `${repoRoot}\0${targetBranch}`;
    let mutex = this.mergeMutexes.get(key);
    if (!mutex) {
      mutex = new AsyncMutex();
      this.mergeMutexes.set(key, mutex);
    }
    return mutex.runExclusive(operation);
  }

  private releaseRun(lease: RunLease): void {
    if (lease.released) return;
    lease.released = true;

    const activeRuns = this.activeRunCountsByRepo.get(lease.repoRoot) ?? 0;
    if (activeRuns <= 1) {
      this.activeRunCountsByRepo.delete(lease.repoRoot);
    } else {
      this.activeRunCountsByRepo.set(lease.repoRoot, activeRuns - 1);
    }

    if (lease.headMode) {
      const activeHeads = this.activeHeadCountsByRepo.get(lease.repoRoot) ?? 0;
      if (activeHeads <= 1) {
        this.activeHeadCountsByRepo.delete(lease.repoRoot);
      } else {
        this.activeHeadCountsByRepo.set(lease.repoRoot, activeHeads - 1);
      }
    }

    if (lease.branchLockKey) {
      this.activeBranchLocks.delete(lease.branchLockKey);
    }
  }

  private branchLockKey(repoRoot: string, branch: string): string {
    return `${repoRoot}\0${branch}`;
  }
}

export const generateRunBranch = (runId: string, name?: string): string => {
  const suffix = sanitizeRunId(runId);
  if (name) return `sandcastle/${sanitizeName(name)}/${suffix}`;
  return `sandcastle/${suffix}`;
};

const sanitizeName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "-");

const sanitizeRunId = (runId: string): string =>
  runId.replace(/[^A-Za-z0-9._-]/g, "-");
