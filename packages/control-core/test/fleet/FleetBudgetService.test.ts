import { describe, expect, it } from "vitest";
import type { OperativeIdentity } from "@sandcastle/protocol";
import {
  BudgetExceededError,
  FleetBudgetService,
  type ActiveRunBudgetRecord,
} from "../../src/fleet/FleetBudgetService.js";

const operative: OperativeIdentity = {
  id: "codex-one",
  codename: "Codex One",
  provider: "codex",
  model: "gpt-5.4",
  species: "synthetic",
  className: "Builder",
  level: 1,
  globalXp: 0,
  bond: 0,
  streak: 0,
  concurrencyCap: 2,
  sleeveCardIds: [],
  unlockedTraits: [],
};

const activeRun = (
  id: string,
  overrides?: Partial<ActiveRunBudgetRecord>,
): ActiveRunBudgetRecord => ({
  id,
  operativeId: "codex-one",
  repoRoot: "C:/repo-a",
  status: "casting",
  ...overrides,
});

describe("FleetBudgetService", () => {
  it("rejects when operative cap is exceeded", () => {
    const service = new FleetBudgetService({ repoConcurrencyCap: 5 });

    expect(() =>
      service.assertCanStart({
        operative,
        repoRoot: "C:/repo-b",
        activeRuns: [activeRun("a"), activeRun("b")],
      }),
    ).toThrow(BudgetExceededError);
  });

  it("rejects when repo cap is exceeded", () => {
    const service = new FleetBudgetService({ repoConcurrencyCap: 1 });

    expect(() =>
      service.assertCanStart({
        operative,
        repoRoot: "C:/repo-a",
        activeRuns: [activeRun("a", { operativeId: "other" })],
      }),
    ).toThrow(BudgetExceededError);
  });

  it("allows starts when operative and repo caps have headroom", () => {
    const service = new FleetBudgetService({ repoConcurrencyCap: 5 });

    expect(() =>
      service.assertCanStart({
        operative,
        repoRoot: "C:/repo-a",
        activeRuns: [activeRun("a", { status: "victory" })],
      }),
    ).not.toThrow();
  });

  it("reports the dimension that failed", () => {
    const service = new FleetBudgetService({ repoConcurrencyCap: 5 });

    try {
      service.assertCanStart({
        operative: { ...operative, concurrencyCap: 1 },
        repoRoot: "C:/repo-a",
        activeRuns: [activeRun("a")],
      });
      throw new Error("Expected budget rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(BudgetExceededError);
      expect((error as BudgetExceededError).dimension).toBe("operative");
      expect((error as BudgetExceededError).toJSON()).toMatchObject({
        code: "BUDGET_EXCEEDED",
        dimension: "operative",
      });
    }
  });
});
