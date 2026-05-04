import { describe, expect, it } from "vitest";
import { ActivityFeed } from "../../src/activity/ActivityFeed.js";
import { SqliteStore } from "../../src/telemetry/SqliteStore.js";
import { makeRepo } from "../helpers.js";
import type { Run } from "@sandcastle/protocol";

const run: Run = {
  id: "run-a",
  planetId: "planet-local",
  operativeId: "op-a",
  provider: "codex",
  sandboxProvider: "no-sandbox",
  status: "starting",
  directive: "do it",
  branch: "main",
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: null,
  phaseIds: [],
  currentPhaseId: null,
  verification: { allGreen: false, failedChecks: [] },
  totals: { toolCalls: 0, filesEdited: 0, commandsRun: 0 },
};

describe("ActivityFeed", () => {
  it("records run.started through run.resolved in order", () => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const feed = new ActivityFeed(store);
      feed.recordRunEvent(repo, run, {
        type: "run.started",
        runId: run.id,
        directive: run.directive,
        branch: run.branch,
        iteration: 0,
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
      });
      feed.recordRunEvent(repo, run, {
        type: "run.resolved",
        runId: run.id,
        result: "victory",
        xpDelta: 500,
        iteration: 0,
        timestamp: new Date("2026-01-01T00:01:00.000Z"),
      });

      expect(feed.getRecent(repo).map((event) => event.type)).toEqual([
        "run.resolved",
        "run.started",
      ]);
    } finally {
      store.close();
    }
  });

  it("honors limit and repoRoot filter", () => {
    const repo = makeRepo();
    const other = makeRepo();
    const store = new SqliteStore(repo);
    try {
      const feed = new ActivityFeed(store);
      for (let index = 0; index < 3; index++) {
        feed.append(repo, {
          id: `event-${index}`,
          at: `2026-01-01T00:0${index}:00.000Z`,
          type: "intervention.used",
          runId: "run-a",
          planetId: "planet-local",
          operativeId: "op-a",
          payload: { action: "merge" },
        });
      }
      feed.append(other, {
        id: "other",
        at: "2026-01-01T00:04:00.000Z",
        type: "intervention.used",
        runId: "run-other",
        planetId: "planet-local",
        operativeId: "op-a",
        payload: { action: "merge" },
      });

      expect(feed.getRecent(repo, 2).map((event) => event.id)).toEqual([
        "event-2",
        "event-1",
      ]);
    } finally {
      store.close();
    }
  });
});
