import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "../src/server.js";
import { RunSupervisor } from "../src/runs/RunSupervisor.js";
import { SqliteStore } from "../src/telemetry/SqliteStore.js";
import { GlobalRepoStore } from "../src/repos/GlobalRepoStore.js";
import { OperativeStore } from "../src/operatives/OperativeStore.js";
import { RepoRegistry } from "../src/repos/RepoRegistry.js";
import { fakeAgent, makeRepo } from "./helpers.js";

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

describe("server quest-forge routes", () => {
  it("parses a directive into deterministic phases", async () => {
    const repo = makeRepo();
    const server = await startServer({
      token: "secret",
      ...isolatedDeps(repo),
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/quest-forge/parse`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({ directive: "Add parser. Test parser." }),
        },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        phases: Array<{ title: string }>;
      };
      expect(
        body.phases.map((phase: { title: string }) => phase.title),
      ).toEqual(["Add parser.", "Test parser."]);
    } finally {
      await server.close();
    }
  });

  it("engages provided phases and returns a run id", async () => {
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
      const response = await fetch(
        `http://127.0.0.1:${server.port}/quest-forge/engage`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer secret",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            directive: "Add parser.",
            phases: [
              {
                id: "p1",
                ordinal: 1,
                title: "Add parser.",
                directiveSlice: "Add parser.",
                objective: "Add parser",
                xpEstimate: 75,
                verifyRules: [],
              },
            ],
          }),
        },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        runId: expect.any(String),
      });
    } finally {
      await server.close();
    }
  }, 10000);

  it("requires bearer auth", async () => {
    const repo = makeRepo();
    const server = await startServer({
      token: "secret",
      ...isolatedDeps(repo),
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/quest-forge/parse`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ directive: "Add parser." }),
        },
      );
      expect(response.status).toBe(401);
    } finally {
      await server.close();
    }
  });
});
