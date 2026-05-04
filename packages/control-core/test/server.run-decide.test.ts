import { describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import type { RunSupervisor } from "../src/runs/RunSupervisor.js";
import { makeRepo } from "./helpers.js";

const auth = {
  authorization: "Bearer secret",
  "content-type": "application/json",
};

const makeSupervisor = (): RunSupervisor =>
  ({
    subscribe: () => () => undefined,
    listRuns: () => [],
    getRun: () => undefined,
    startRun: async () => ({ runId: "unused" }),
    cancelRun: () => false,
    mergeAllGreen: async () => ({ results: [], aborted: false }),
    decideRun: async (runId: string, request: { kind: string }) =>
      runId === "missing" ? undefined : { runId, kind: request.kind, ok: true },
  }) as unknown as RunSupervisor;

describe("POST /runs/:id/decide", () => {
  it.each(["merge", "revise", "discard"] as const)(
    "accepts %s decisions",
    async (kind) => {
      const server = await startServer({
        repo: makeRepo(),
        token: "secret",
        runSupervisor: makeSupervisor(),
      });
      try {
        const response = await fetch(
          `http://127.0.0.1:${server.port}/runs/run-a/decide`,
          {
            method: "POST",
            headers: auth,
            body: JSON.stringify({ kind }),
          },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          runId: "run-a",
          kind,
          ok: true,
        });
      } finally {
        await server.close();
      }
    },
  );

  it("returns 404 for unknown run ids", async () => {
    const server = await startServer({
      repo: makeRepo(),
      token: "secret",
      runSupervisor: makeSupervisor(),
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/runs/missing/decide`,
        {
          method: "POST",
          headers: auth,
          body: JSON.stringify({ kind: "merge" }),
        },
      );

      expect(response.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
