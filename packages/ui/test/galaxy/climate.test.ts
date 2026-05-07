import { describe, it, expect } from "vitest";
import type { Planet } from "@sandcastle/protocol";
import { planetClimate } from "../../src/galaxy/climate";

const baseDeck = {
  version: 1 as const,
  mode: {
    id: "m",
    slug: "m",
    title: "M",
    summary: "",
    sourcePath: "",
    enabled: true,
    tags: [],
    body: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
    type: "mode" as const,
    constraints: [],
  },
  skills: [],
  commands: [],
  order: [],
};

const basePlanet = (overrides: Partial<Planet> = {}): Planet => ({
  id: "p1",
  repoName: "sandcastle",
  repoRoot: "/repo",
  defaultBranch: "main",
  terraformStage: 2,
  scars: [],
  wards: [],
  deck: baseDeck,
  telemetry: {
    coveragePct: null,
    ciGreenRate30d: null,
    openIssues: null,
    churnScore: null,
    ageDays: null,
    testCount: null,
    branch: "main",
    lastCommitAt: new Date().toISOString(),
    lastIndexedAt: null,
  },
  activeRunIds: [],
  lastRunAt: null,
  ...overrides,
});

describe("planetClimate", () => {
  it("returns 'live' when there is an active run", () => {
    const p = basePlanet({ activeRunIds: ["run_1"] });
    expect(planetClimate(p)).toBe("live");
  });

  it("returns 'storm' for high churn or open-issue counts", () => {
    expect(
      planetClimate(
        basePlanet({
          telemetry: {
            ...basePlanet().telemetry,
            openIssues: 9,
          },
        }),
      ),
    ).toBe("storm");

    expect(
      planetClimate(
        basePlanet({
          telemetry: {
            ...basePlanet().telemetry,
            churnScore: 0.9,
          },
        }),
      ),
    ).toBe("storm");
  });

  it("returns 'clear' for high coverage + good CI", () => {
    expect(
      planetClimate(
        basePlanet({
          telemetry: {
            ...basePlanet().telemetry,
            coveragePct: 78,
            ciGreenRate30d: 95,
          },
        }),
      ),
    ).toBe("clear");
  });

  it("does not treat CI green-rate percents as fractions", () => {
    expect(
      planetClimate(
        basePlanet({
          telemetry: {
            ...basePlanet().telemetry,
            coveragePct: 78,
            ciGreenRate30d: 50,
          },
        }),
      ),
    ).toBe("warm");
  });

  it("returns 'idle' when the repo hasn't seen a commit in 30+ days", () => {
    const old = new Date();
    old.setDate(old.getDate() - 90);
    expect(
      planetClimate(
        basePlanet({
          telemetry: {
            ...basePlanet().telemetry,
            lastCommitAt: old.toISOString(),
          },
        }),
      ),
    ).toBe("idle");
  });

  it("falls back to 'warm' for unclassified planets", () => {
    expect(planetClimate(basePlanet())).toBe("warm");
  });
});
