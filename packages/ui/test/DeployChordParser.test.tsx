import { describe, expect, it } from "vitest";
import {
  parseDeployChord,
  type PlanetForParser,
} from "../src/deploy/parseDeployChord.js";

const planets: readonly PlanetForParser[] = [
  { id: "planet_alpha", repoName: "alpha" },
  { id: "planet_beta", repoName: "beta" },
  { id: "planet_pi-default", repoName: "pi-default" },
];

describe("parseDeployChord", () => {
  it("treats a bare directive as a single-target / current planet input", () => {
    const result = parseDeployChord("fix the bug", planets);
    expect(result.multiTargetForm).toBe(false);
    expect(result.targets).toEqual([]);
    expect(result.directive).toBe("fix the bug");
    expect(result.unknownTargets).toEqual([]);
    expect(result.operativeId).toBeUndefined();
  });

  it("parses two targets with no operative", () => {
    const result = parseDeployChord(
      "deploy to alpha, beta :: refactor",
      planets,
    );
    expect(result.multiTargetForm).toBe(true);
    expect(result.targets.map((t) => t.repoName)).toEqual(["alpha", "beta"]);
    expect(result.operativeId).toBeUndefined();
    expect(result.directive).toBe("refactor");
    expect(result.unknownTargets).toEqual([]);
  });

  it("parses an operative id, single target, and directive", () => {
    const result = parseDeployChord(
      "deploy pi-default to alpha :: do thing",
      planets,
    );
    expect(result.multiTargetForm).toBe(true);
    expect(result.operativeId).toBe("pi-default");
    expect(result.targets.map((t) => t.repoName)).toEqual(["alpha"]);
    expect(result.directive).toBe("do thing");
  });

  it("flags unknown targets while keeping known ones", () => {
    const result = parseDeployChord("deploy to alpha, ghost :: x", planets);
    expect(result.multiTargetForm).toBe(true);
    expect(result.targets.map((t) => t.repoName)).toEqual(["alpha"]);
    expect(result.unknownTargets).toEqual(["ghost"]);
    expect(result.directive).toBe("x");
  });

  it("returns an empty parse for whitespace-only input", () => {
    const result = parseDeployChord("   \n  ", planets);
    expect(result.multiTargetForm).toBe(false);
    expect(result.targets).toEqual([]);
    expect(result.directive).toBe("");
    expect(result.unknownTargets).toEqual([]);
  });

  it("returns an empty parse for empty input", () => {
    const result = parseDeployChord("", planets);
    expect(result.multiTargetForm).toBe(false);
    expect(result.targets).toEqual([]);
    expect(result.directive).toBe("");
  });

  it("matches case-insensitively against repoName", () => {
    const result = parseDeployChord("deploy to ALPHA :: y", planets);
    expect(result.targets[0]?.id).toBe("planet_alpha");
  });

  it("matches against planet id when repoName does not match", () => {
    const idOnly: readonly PlanetForParser[] = [
      { id: "main-app", repoName: "Sandcastle" },
    ];
    const result = parseDeployChord("deploy to main-app :: y", idOnly);
    expect(result.targets.map((t) => t.id)).toEqual(["main-app"]);
  });

  it("dedupes when the same planet matches twice", () => {
    const result = parseDeployChord("deploy to alpha, alpha :: x", planets);
    expect(result.targets.map((t) => t.id)).toEqual(["planet_alpha"]);
  });

  it("treats `deploy` with no `to` as a route slug, not a directive", () => {
    const result = parseDeployChord("deploy alpha :: x", planets);
    // Without an explicit `to`, the entire route segment is treated as the
    // target list. We treat "alpha" as a target — substring match.
    expect(result.multiTargetForm).toBe(true);
    expect(result.targets.map((t) => t.repoName)).toEqual(["alpha"]);
    expect(result.directive).toBe("x");
    expect(result.operativeId).toBeUndefined();
  });

  it("supports the `deploy to <planet>` form with no directive separator", () => {
    const result = parseDeployChord("deploy to alpha", planets);
    expect(result.multiTargetForm).toBe(true);
    expect(result.targets.map((t) => t.repoName)).toEqual(["alpha"]);
    expect(result.directive).toBe("");
  });
});
