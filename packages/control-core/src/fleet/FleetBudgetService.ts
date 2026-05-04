import type { OperativeIdentity, RunStatus } from "@sandcastle/protocol";

export type BudgetExceededDimension = "operative" | "repo";

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED";

  constructor(
    readonly dimension: BudgetExceededDimension,
    readonly limit: number,
    readonly active: number,
    readonly id: string,
  ) {
    super(
      `Concurrency budget exceeded for ${dimension} '${id}': ${active}/${limit} active`,
    );
    this.name = "BudgetExceededError";
  }

  toJSON(): {
    readonly code: "BUDGET_EXCEEDED";
    readonly dimension: BudgetExceededDimension;
    readonly limit: number;
    readonly active: number;
    readonly id: string;
    readonly message: string;
  } {
    return {
      code: this.code,
      dimension: this.dimension,
      limit: this.limit,
      active: this.active,
      id: this.id,
      message: this.message,
    };
  }
}

export interface ActiveRunBudgetRecord {
  readonly id: string;
  readonly operativeId: string;
  readonly repoRoot: string;
  readonly status: RunStatus;
}

export interface FleetBudgetServiceOptions {
  readonly repoConcurrencyCap?: number;
}

const ACTIVE_STATUSES = new Set<RunStatus>([
  "queued",
  "starting",
  "casting",
  "striking",
  "verifying",
  "win-pending",
  "fail-pending",
]);

export class FleetBudgetService {
  private readonly repoConcurrencyCap: number;

  constructor(options?: FleetBudgetServiceOptions) {
    this.repoConcurrencyCap = options?.repoConcurrencyCap ?? 5;
  }

  assertCanStart(input: {
    readonly operative: OperativeIdentity;
    readonly repoRoot: string;
    readonly activeRuns: readonly ActiveRunBudgetRecord[];
  }): void {
    const activeRuns = input.activeRuns.filter((run) =>
      ACTIVE_STATUSES.has(run.status),
    );
    const operativeActive = activeRuns.filter(
      (run) => run.operativeId === input.operative.id,
    ).length;
    if (operativeActive >= input.operative.concurrencyCap) {
      throw new BudgetExceededError(
        "operative",
        input.operative.concurrencyCap,
        operativeActive,
        input.operative.id,
      );
    }

    const repoActive = activeRuns.filter(
      (run) => run.repoRoot === input.repoRoot,
    ).length;
    if (repoActive >= this.repoConcurrencyCap) {
      throw new BudgetExceededError(
        "repo",
        this.repoConcurrencyCap,
        repoActive,
        input.repoRoot,
      );
    }
  }
}
