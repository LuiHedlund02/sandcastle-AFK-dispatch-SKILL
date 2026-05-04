import { describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import type { RunSupervisor } from "../src/runs/RunSupervisor.js";
import { makeRepo } from "./helpers.js";

const auth = { authorization: "Bearer secret" };

const makeSupervisor = (
  mergeAllGreen: () => Promise<{
    results: Array<{
      runId: string;
      ok: boolean;
      action: "merge";
      message?: string;
    }>;
    aborted: boolean;
  }>,
): RunSupervisor =>
  ({
    subscribe: () => () => undefined,
    listRuns: () => [],
    getRun: () => undefined,
    startRun: async () => ({ runId: "unused" }),
    cancelRun: () => false,
    decideRun: async () => undefined,
    mergeAllGreen,
  }) as unknown as RunSupervisor;

describe("POST /merge-all-green", () => {
  it("returns per-run results for win-pending runs", async () => {
    const server = await startServer({
      repo: makeRepo(),
      token: "secret",
      runSupervisor: makeSupervisor(async () => ({
        results: [
          { runId: "run-a", ok: true, action: "merge" },
          { runId: "run-b", ok: true, action: "merge" },
        ],
        aborted: false,
      })),
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/merge-all-green`,
        { method: "POST", headers: auth },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        results: [
          { runId: "run-a", ok: true, action: "merge" },
          { runId: "run-b", ok: true, action: "merge" },
        ],
        aborted: false,
      });
    } finally {
      await server.close();
    }
  });

  it("requires bearer auth", async () => {
    const server = await startServer({
      repo: makeRepo(),
      token: "secret",
      runSupervisor: makeSupervisor(async () => ({
        results: [],
        aborted: false,
      })),
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/merge-all-green`,
        { method: "POST" },
      );

      expect(response.status).toBe(401);
    } finally {
      await server.close();
    }
  });

  it("early-aborts on first failure and returns partial results", async () => {
    const server = await startServer({
      repo: makeRepo(),
      token: "secret",
      runSupervisor: makeSupervisor(async () => ({
        results: [
          { runId: "run-a", ok: true, action: "merge" },
          {
            runId: "run-b",
            ok: false,
            action: "merge",
            message: "merge failed",
          },
        ],
        aborted: true,
      })),
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/merge-all-green`,
        { method: "POST", headers: auth },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        results: [
          { runId: "run-a", ok: true },
          { runId: "run-b", ok: false, message: "merge failed" },
        ],
        aborted: true,
      });
    } finally {
      await server.close();
    }
  });
});
