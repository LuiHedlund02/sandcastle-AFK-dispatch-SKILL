import { describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import { SqliteStore } from "../src/telemetry/SqliteStore.js";
import { makeRepo } from "./helpers.js";

describe("GET /operatives/:id/xp", () => {
  it("returns totalXp and recentRuns", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    store.insertXpEntry({
      runId: "run-a",
      repoRoot: repo,
      operativeId: "op-a",
      patchHash: "hash-a",
      baseXp: 500,
      bonus: 0,
      penalty: 0,
      netXp: 500,
      recordedAt: "2026-01-01T00:00:00.000Z",
      revertedAt: null,
    });
    const server = await startServer({ token: "secret", repo, store });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/operatives/op-a/xp`,
        { headers: { authorization: "Bearer secret" } },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        totalXp: 500,
        recentRuns: [
          {
            runId: "run-a",
            netXp: 500,
            recordedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      });
    } finally {
      await server.close();
    }
  });
});
