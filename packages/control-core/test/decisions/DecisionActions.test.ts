import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Run, RunEvent } from "@sandcastle/protocol";
import { DecisionActions } from "../../src/decisions/DecisionActions.js";
import { RepoRunCoordinator } from "../../src/runs/RepoRunCoordinator.js";
import { makeRepo } from "../helpers.js";

const makeRun = (id: string, branch = `sandcastle/${id}`): Run => ({
  id,
  planetId: "planet-local",
  operativeId: "pi-default",
  provider: "codex",
  sandboxProvider: "host-bind-mount",
  status: "win-pending",
  directive: "do it",
  branch,
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: null,
  phaseIds: [],
  currentPhaseId: null,
  verification: { allGreen: true, failedChecks: [] },
  totals: { toolCalls: 0, filesEdited: 0, commandsRun: 0 },
});

describe("DecisionActions", () => {
  it("runs merge actions under the merge mutex and reports success", async () => {
    const runs = new Map<string, Run>([
      ["run-a", makeRun("run-a")],
      ["run-b", makeRun("run-b")],
    ]);
    const coordinator = new RepoRunCoordinator();
    const events: RunEvent[] = [];
    let active = 0;
    let maxActive = 0;

    const actions = new DecisionActions({
      repoRoot: "C:/repo",
      coordinator,
      getRun: (runId) => runs.get(runId),
      emitEvent: (_runId, event) => events.push(event),
      targetBranch: async () => "main",
      mergeImpl: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
      },
    });

    const results = await Promise.all([
      actions.decide("run-a", { kind: "merge" }),
      actions.decide("run-b", { kind: "merge" }),
    ]);

    expect(results.every((result) => result?.ok)).toBe(true);
    expect(maxActive).toBe(1);
    expect(
      events.filter((event) => event.type === "run.resolved"),
    ).toHaveLength(2);
  });

  it("returns a failed merge response when the merge implementation rejects", async () => {
    const run = makeRun("run-a");
    const actions = new DecisionActions({
      repoRoot: "C:/repo",
      coordinator: new RepoRunCoordinator(),
      getRun: () => run,
      emitEvent: () => undefined,
      targetBranch: async () => "main",
      mergeImpl: async () => {
        throw new Error("merge failed");
      },
    });

    await expect(
      actions.decide("run-a", { kind: "merge" }),
    ).resolves.toMatchObject({
      ok: false,
      message: "merge failed",
    });
  });

  it("discards by deleting the run worktree and branch", async () => {
    const repo = makeRepo();
    const branch = "sandcastle/run-discard";
    const worktreePath = join(
      repo,
      ".sandcastle",
      "worktrees",
      "sandcastle-run-discard",
    );
    execFileSync("git", ["branch", branch], { cwd: repo });
    mkdirSync(join(repo, ".sandcastle", "worktrees"), { recursive: true });
    execFileSync("git", ["worktree", "add", worktreePath, branch], {
      cwd: repo,
      stdio: "ignore",
    });
    writeFileSync(join(worktreePath, "scratch.txt"), "discard me");

    const run = { ...makeRun("run-discard", branch), worktreePath };
    const actions = new DecisionActions({
      repoRoot: repo,
      coordinator: new RepoRunCoordinator(),
      getRun: () => run,
      emitEvent: () => undefined,
    });

    await expect(
      actions.decide(run.id, { kind: "discard" }),
    ).resolves.toMatchObject({
      ok: true,
    });
    expect(existsSync(worktreePath)).toBe(false);
    expect(() =>
      execFileSync("git", ["rev-parse", "--verify", branch], { cwd: repo }),
    ).toThrow();
  });

  it("accepts revise as a Phase 2 no-op", async () => {
    const run = makeRun("run-a");
    const actions = new DecisionActions({
      repoRoot: "C:/repo",
      coordinator: new RepoRunCoordinator(),
      getRun: () => run,
      emitEvent: () => undefined,
    });

    await expect(actions.decide("run-a", { kind: "revise" })).resolves.toEqual({
      runId: "run-a",
      kind: "revise",
      ok: true,
      message: "No-op in Phase 2",
    });
  });
});
