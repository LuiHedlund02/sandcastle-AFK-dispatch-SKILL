import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// Direct import of the no-JSX entry of the transport package — node test
// env, no React. We're proving that the same factory wired against two
// fetch instances yields the same query shape.
import { apiClient } from "@sandcastle/transport/core";
import { startServer } from "../../src/server.js";
import { RunSupervisor } from "../../src/runs/RunSupervisor.js";
import { SqliteStore } from "../../src/telemetry/SqliteStore.js";
import { GlobalRepoStore } from "../../src/repos/GlobalRepoStore.js";
import { OperativeStore } from "../../src/operatives/OperativeStore.js";
import { RepoRegistry } from "../../src/repos/RepoRegistry.js";
import { fakeAgent, makeRepo } from "../helpers.js";

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

describe("transport parity", () => {
  it("factory yields identical-shape responses across fetch instances", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    const runSupervisor = new RunSupervisor({
      repoRoot: repo,
      store,
      agentFactory: () => fakeAgent(),
    });
    const server = await startServer({
      token: "secret",
      runSupervisor,
      store,
      ...isolatedDeps(repo),
    });

    try {
      const baseUrl = `http://127.0.0.1:${server.port}`;
      const connection = { baseUrl, token: "secret" };

      // Two clients constructed via the same factory but with different
      // fetch instances. If the factory leaked any state between calls,
      // this would diverge.
      const fetchA: typeof fetch = (input, init) => fetch(input, init);
      const fetchB: typeof fetch = (input, init) => fetch(input, init);
      const clientA = apiClient(connection, { fetch: fetchA });
      const clientB = apiClient(connection, { fetch: fetchB });

      // ── getFleet
      const fleetA = await clientA.getFleet();
      const fleetB = await clientB.getFleet();
      // `updatedAt` is the only field that may legitimately drift between
      // calls — strip it and compare the rest of the snapshot shape.
      const stripUpdatedAt = (
        f: typeof fleetA,
      ): Omit<typeof fleetA, "updatedAt"> => {
        const { updatedAt: _u, ...rest } = f;
        return rest;
      };
      expect(stripUpdatedAt(fleetA)).toEqual(stripUpdatedAt(fleetB));
      expect(fleetA.capacity).toEqual({ used: 0, max: 1 });

      // ── getRepo
      const repoA = await clientA.getRepo();
      const repoB = await clientB.getRepo();
      expect(repoA).toEqual(repoB);
      // assert the response is a plain object with the protocol-shaped
      // properties — proves the zod parser ran on both sides.
      expect(typeof repoA.root).toBe("string");

      // ── getRepos
      const reposA = await clientA.getRepos();
      const reposB = await clientB.getRepos();
      expect(reposA).toEqual(reposB);
      expect(Array.isArray(reposA.repos)).toBe(true);

      // ── getOperatives
      const opsA = await clientA.getOperatives();
      const opsB = await clientB.getOperatives();
      expect(opsA).toEqual(opsB);
    } finally {
      await server.close();
    }
  }, 20_000);
});
