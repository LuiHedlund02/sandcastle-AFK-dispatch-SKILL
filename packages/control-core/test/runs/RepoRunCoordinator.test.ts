import { describe, expect, it } from "vitest";
import {
  BranchModeLockError,
  HeadStrategyNotParallelError,
  RepoRunCoordinator,
} from "../../src/runs/RepoRunCoordinator.js";

const repoRoot = "C:/repo";

describe("RepoRunCoordinator", () => {
  it("allocates 100 unique branches for parallel runs to the same repo", async () => {
    const coordinator = new RepoRunCoordinator();
    const prepared = await Promise.all(
      Array.from({ length: 100 }, () =>
        Promise.resolve(
          coordinator.prepareRun({
            repoRoot,
            targetBranch: "main",
            strategy: { type: "merge-to-head" },
          }),
        ),
      ),
    );

    const branches = new Set(prepared.map((run) => run.branch));
    expect(branches.size).toBe(100);
    expect(
      [...branches].every((branch) => branch.startsWith("sandcastle/")),
    ).toBe(true);

    for (const run of prepared) run.release();
  });

  it("serializes simultaneous merges to the same default branch", async () => {
    const coordinator = new RepoRunCoordinator();
    let active = 0;
    let maxActive = 0;
    const order: number[] = [];

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        coordinator.withMergeMutex(repoRoot, "main", async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          order.push(index);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active--;
        }),
      ),
    );

    expect(maxActive).toBe(1);
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it("rejects a second active run on the same explicit branch", () => {
    const coordinator = new RepoRunCoordinator();
    const first = coordinator.prepareRun({
      repoRoot,
      targetBranch: "main",
      strategy: { type: "branch", branch: "feature/a" },
    });

    expect(() =>
      coordinator.prepareRun({
        repoRoot,
        targetBranch: "main",
        strategy: { type: "branch", branch: "feature/a" },
      }),
    ).toThrow(BranchModeLockError);

    first.release();
    expect(() =>
      coordinator
        .prepareRun({
          repoRoot,
          targetBranch: "main",
          strategy: { type: "branch", branch: "feature/a" },
        })
        .release(),
    ).not.toThrow();
  });

  it("rejects head strategy when another run is active on the same repo", () => {
    const coordinator = new RepoRunCoordinator();
    const first = coordinator.prepareRun({
      repoRoot,
      targetBranch: "main",
      strategy: { type: "merge-to-head" },
    });

    expect(() =>
      coordinator.prepareRun({
        repoRoot,
        targetBranch: "main",
        strategy: { type: "head" },
      }),
    ).toThrow(HeadStrategyNotParallelError);

    first.release();
  });

  it("releases a held lock when the supervised run rejects", async () => {
    const coordinator = new RepoRunCoordinator();

    await expect(
      coordinator.withRun(
        {
          repoRoot,
          targetBranch: "main",
          strategy: { type: "branch", branch: "feature/abort" },
        },
        async () => {
          throw new Error("aborted");
        },
      ),
    ).rejects.toThrow("aborted");

    const next = coordinator.prepareRun({
      repoRoot,
      targetBranch: "main",
      strategy: { type: "branch", branch: "feature/abort" },
    });
    next.release();
  });
});
