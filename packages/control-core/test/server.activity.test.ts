import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityFeed } from "../src/activity/ActivityFeed.js";
import { GlobalRepoStore } from "../src/repos/GlobalRepoStore.js";
import { RepoRegistry } from "../src/repos/RepoRegistry.js";
import { startServer } from "../src/server.js";
import { SqliteStore } from "../src/telemetry/SqliteStore.js";
import { makeRepo } from "./helpers.js";

const homes: string[] = [];

const deps = (repo: string) => {
  const home = mkdtempSync(join(tmpdir(), "sandcastle-home-"));
  homes.push(home);
  return {
    repoRegistry: new RepoRegistry(
      repo,
      new GlobalRepoStore(join(home, ".sandcastle")),
    ),
  };
};

afterEach(() => {
  for (const home of homes.splice(0))
    rmSync(home, { recursive: true, force: true });
});

describe("GET /repos/:id/activity", () => {
  it("returns recent activity with auth", async () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    const repoRegistry = deps(repo).repoRegistry;
    const repoId = repoRegistry.listRepos()[0]!.id;
    new ActivityFeed(store).append(repo, {
      id: "event-a",
      at: "2026-01-01T00:00:00.000Z",
      type: "run.started",
      runId: "run-a",
      planetId: "planet-local",
      operativeId: "op-a",
      payload: { directive: "do it" },
    });
    const server = await startServer({
      token: "secret",
      store,
      repoRegistry,
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/repos/${repoId}/activity?limit=10`,
        { headers: { authorization: "Bearer secret" } },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        events: [{ id: "event-a", type: "run.started" }],
      });
    } finally {
      await server.close();
    }
  });
});
