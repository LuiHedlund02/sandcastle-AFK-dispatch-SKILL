import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Run } from "@sandcastle/protocol";
import { DecisionActions } from "../../src/decisions/DecisionActions.js";
import { RepoRunCoordinator } from "../../src/runs/RepoRunCoordinator.js";
import { SqliteStore } from "../../src/telemetry/SqliteStore.js";
import { XpLedger } from "../../src/xp/XpLedger.js";
import { makeRepo } from "../helpers.js";

const makeRun = (id: string, branch = `sandcastle/${id}`): Run => ({
  id,
  planetId: "planet-local",
  operativeId: "op-a",
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

const commitOnBranch = (repo: string, branch: string, file: string): void => {
  execFileSync("git", ["checkout", "-b", branch], {
    cwd: repo,
    stdio: "ignore",
  });
  writeFileSync(join(repo, file), "export const value = 1;\n");
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-m", "feat: value"], {
    cwd: repo,
    stdio: "ignore",
  });
  execFileSync("git", ["checkout", "main"], { cwd: repo, stdio: "ignore" });
};

describe("DecisionActions.merge XP", () => {
  it("returns xpDelta after a successful merge", async () => {
    const repo = makeRepo();
    const branch = "sandcastle/run-xp";
    commitOnBranch(repo, branch, "value.ts");
    const store = new SqliteStore(repo);
    try {
      const run = makeRun("run-xp", branch);
      const actions = new DecisionActions({
        repoRoot: repo,
        coordinator: new RepoRunCoordinator(),
        getRun: () => run,
        emitEvent: () => undefined,
        xpLedger: new XpLedger(store),
      });

      await expect(
        actions.decide(run.id, { kind: "merge" }),
      ).resolves.toMatchObject({ ok: true, xpDelta: 500 });
    } finally {
      store.close();
    }
  });

  it("rejects a subsequent record of the reverted patch", async () => {
    const repo = makeRepo();
    const branch = "sandcastle/run-revert";
    commitOnBranch(repo, branch, "value.ts");
    const store = new SqliteStore(repo);
    try {
      const ledger = new XpLedger(store);
      const run = makeRun("run-revert", branch);
      const actions = new DecisionActions({
        repoRoot: repo,
        coordinator: new RepoRunCoordinator(),
        getRun: () => run,
        emitEvent: () => undefined,
        xpLedger: ledger,
      });
      await actions.decide(run.id, { kind: "merge" });
      execFileSync("git", ["revert", "--no-edit", "HEAD"], {
        cwd: repo,
        stdio: "ignore",
      });
      await ledger.detectReverts(repo);

      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo })
        .toString()
        .trim();
      writeFileSync(join(repo, "value.ts"), "export const value = 1;\n");
      execFileSync("git", ["add", "."], { cwd: repo });
      execFileSync("git", ["commit", "-m", "feat: value again"], {
        cwd: repo,
        stdio: "ignore",
      });
      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo })
        .toString()
        .trim();

      await expect(
        ledger.recordMerge({
          runId: "run-again",
          repoRoot: repo,
          beforeCommit: before,
          afterCommit: after,
          mergedIntoBranch: "main",
        }),
      ).resolves.toBe(0);
    } finally {
      store.close();
    }
  });
});
