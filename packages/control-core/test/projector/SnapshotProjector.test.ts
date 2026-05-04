import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OperativeStore } from "../../src/operatives/OperativeStore.js";
import { SnapshotProjector } from "../../src/projector/SnapshotProjector.js";
import { GlobalRepoStore } from "../../src/repos/GlobalRepoStore.js";
import { RepoRegistry } from "../../src/repos/RepoRegistry.js";
import { RunSupervisor } from "../../src/runs/RunSupervisor.js";
import { SqliteStore } from "../../src/telemetry/SqliteStore.js";
import { makeRepo } from "../helpers.js";

describe("SnapshotProjector", () => {
  it("lazily indexes real telemetry into fleet planets", async () => {
    const repo = makeRepo();
    mkdirSync(join(repo, "coverage"));
    writeFileSync(
      join(repo, "coverage", "coverage-summary.json"),
      JSON.stringify({ total: { lines: { pct: 91.25 } } }),
    );
    writeFileSync(join(repo, "projector.test.ts"), "test('x', () => {});\n");

    const registry = new RepoRegistry(repo, makeGlobalStore());
    const registered = registry.getCurrentRepo();
    const store = new SqliteStore(repo);
    const operativeStore = new OperativeStore();
    const runSupervisor = new RunSupervisor({
      repoRoot: repo,
      store,
      operativeStore,
    });

    try {
      expect(store.getRepoTelemetry(registered.id)).toBeUndefined();

      const fleet = await new SnapshotProjector(
        registry,
        runSupervisor,
        undefined,
        operativeStore,
      ).getFleetState();
      const planet = fleet.planetsById["planet-local"];

      expect(planet?.telemetry).toMatchObject({
        coveragePct: 91.25,
        ciGreenRate30d: null,
        openIssues: null,
        branch: "main",
        testCount: 1,
      });
      expect(planet?.telemetry.ageDays).toBeGreaterThanOrEqual(0);
      expect(planet?.telemetry.lastCommitAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(planet?.telemetry.lastIndexedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(store.getRepoTelemetry(registered.id)?.coveragePct).toBe(91.25);
    } finally {
      store.close();
    }
  });
});

const makeGlobalStore = (): GlobalRepoStore =>
  new GlobalRepoStore(mkdtempSync(join(tmpdir(), "sandcastle-home-")));
