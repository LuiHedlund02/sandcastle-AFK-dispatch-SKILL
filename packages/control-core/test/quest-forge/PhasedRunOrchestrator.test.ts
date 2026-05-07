import { describe, expect, it } from "vitest";
import { RunSupervisor } from "../../src/runs/RunSupervisor.js";
import { SqliteStore } from "../../src/telemetry/SqliteStore.js";
import { fakeAgent, makeRepo, waitFor } from "../helpers.js";

describe("PhasedRunOrchestrator", () => {
  it("runs two phases and reaches win-pending", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const supervisor = new RunSupervisor({
        repoRoot: repo,
        store,
        agentFactory: () => fakeAgent(),
      });
      const seen: string[] = [];
      supervisor.subscribe((_runId, event) => seen.push(event.type));
      const { runId } = await supervisor.startPhasedRun({
        directive: "Add one. Fix two.",
        phases: [phase("p1", 1, "Add one."), phase("p2", 2, "Fix two.")],
      });
      await waitFor(
        () => supervisor.getRun(runId)?.status === "win-pending",
        10000,
      );
      expect(seen.filter((type) => type.startsWith("phase."))).toEqual([
        "phase.started",
        "phase.verifying",
        "phase.verified",
        "phase.started",
        "phase.verifying",
        "phase.verified",
      ]);
    } finally {
      store.close();
    }
  }, 15000);

  it("fails on the second phase verify rule and records failed phase", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const supervisor = new RunSupervisor({
        repoRoot: repo,
        store,
        agentFactory: () => fakeAgent(),
      });
      const { runId } = await supervisor.startPhasedRun({
        directive: "Add one. Fix two.",
        phases: [
          phase("p1", 1, "Add one."),
          {
            ...phase("p2", 2, "Fix two."),
            verifyRules: [
              { kind: "file", path: "missing.txt", mustExist: true },
            ],
          },
        ],
      });
      await waitFor(
        () => supervisor.getRun(runId)?.status === "fail-pending",
        10000,
      );
      expect(supervisor.getRun(runId)?.verification.failedPhaseId).toBe("p2");
    } finally {
      store.close();
    }
  }, 15000);

  it("aborts an in-flight phased run", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const supervisor = new RunSupervisor({
        repoRoot: repo,
        store,
        agentFactory: () => fakeAgent({ delayMs: 1000 }),
      });
      const { runId } = await supervisor.startPhasedRun({
        directive: "Add one.",
        phases: [phase("p1", 1, "Add one.")],
      });
      expect(supervisor.cancelRun(runId)).toBe(true);
      await waitFor(
        () => supervisor.getRun(runId)?.status === "aborted",
        10000,
      );
    } finally {
      store.close();
    }
  }, 15000);
});

const phase = (id: string, ordinal: number, directiveSlice: string) => ({
  id,
  ordinal,
  title: directiveSlice,
  directiveSlice,
  objective: directiveSlice,
  xpEstimate: 75,
  verifyRules: [],
});
