import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import { GlobalRepoStore } from "../src/repos/GlobalRepoStore.js";
import { OperativeStore } from "../src/operatives/OperativeStore.js";
import { RepoRegistry } from "../src/repos/RepoRegistry.js";
import type { RunSupervisor } from "../src/runs/RunSupervisor.js";
import { makeRepo } from "./helpers.js";

const auth = {
  authorization: "Bearer secret",
  "content-type": "application/json",
};

const homes: string[] = [];

const isolatedDeps = (repo: string) => {
  const home = mkdtempSync(join(tmpdir(), "sandcastle-home-"));
  homes.push(home);
  const sandcastleHome = join(home, ".sandcastle");
  return {
    repoRegistry: new RepoRegistry(repo, new GlobalRepoStore(sandcastleHome)),
    operativeStore: new OperativeStore(sandcastleHome),
  };
};

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

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
        token: "secret",
        runSupervisor: makeSupervisor(),
        ...isolatedDeps(makeRepo()),
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
      token: "secret",
      runSupervisor: makeSupervisor(),
      ...isolatedDeps(makeRepo()),
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
