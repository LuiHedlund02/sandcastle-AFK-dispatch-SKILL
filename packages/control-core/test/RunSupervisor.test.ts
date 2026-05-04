import { describe, expect, it } from "vitest";
import { RunSupervisor } from "../src/runs/RunSupervisor.js";
import { SqliteStore } from "../src/telemetry/SqliteStore.js";
import { fakeAgent, makeRepo, waitFor } from "./helpers.js";

describe("RunSupervisor", () => {
  it("starts a real host-bind-mount run and forwards events", async () => {
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

      const { runId } = await supervisor.startRun({ directive: "do it" });
      await waitFor(() => supervisor.getRun(runId)?.status === "win-pending");

      expect(seen).toContain("text");
      expect(seen).toContain("tool.started");
      expect(seen).toContain("tool.finished");
      expect(seen).toContain("verification.finished");
      expect(store.listEvents(runId).length).toBeGreaterThan(0);
    } finally {
      store.close();
    }
  }, 10000);

  it("cancels an in-flight run", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const supervisor = new RunSupervisor({
        repoRoot: repo,
        store,
        agentFactory: () => fakeAgent({ delayMs: 1000 }),
      });
      const seen: string[] = [];
      supervisor.subscribe((_runId, event) => seen.push(event.type));

      const { runId } = await supervisor.startRun({ directive: "do it" });
      expect(supervisor.cancelRun(runId)).toBe(true);
      await waitFor(() => supervisor.getRun(runId)?.status === "aborted");

      expect(seen).toContain("intervention.used");
      expect(seen).toContain("run.resolved");
    } finally {
      store.close();
    }
  }, 10000);

  it("runs 5 parallel worktree-backed runs without branch collisions", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const supervisor = new RunSupervisor({
        repoRoot: repo,
        store,
        agentFactory: () => fakeAgent({ delayMs: 50 }),
      });

      const started = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          supervisor.startRun({ directive: `do it ${index}` }),
        ),
      );
      const runIds = started.map((run) => run.runId);

      await waitFor(() =>
        runIds.every(
          (runId) => supervisor.getRun(runId)?.status === "win-pending",
        ),
      );

      const branches = runIds.map((runId) => supervisor.getRun(runId)!.branch);
      expect(new Set(branches).size).toBe(5);
      expect(branches.every((branch) => branch.startsWith("sandcastle/"))).toBe(
        true,
      );
    } finally {
      store.close();
    }
  }, 15000);
});
