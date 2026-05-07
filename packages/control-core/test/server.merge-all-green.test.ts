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

const auth = { authorization: "Bearer secret" };

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
      token: "secret",
      runSupervisor: makeSupervisor(async () => ({
        results: [
          { runId: "run-a", ok: true, action: "merge" },
          { runId: "run-b", ok: true, action: "merge" },
        ],
        aborted: false,
      })),
      ...isolatedDeps(makeRepo()),
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
      token: "secret",
      runSupervisor: makeSupervisor(async () => ({
        results: [],
        aborted: false,
      })),
      ...isolatedDeps(makeRepo()),
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
      ...isolatedDeps(makeRepo()),
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
