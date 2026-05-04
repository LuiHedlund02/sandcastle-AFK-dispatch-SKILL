import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCoveragePct } from "../../../src/telemetry/coverage/CoverageReader.js";

const makeDir = (): string => mkdtempSync(join(tmpdir(), "sandcastle-cov-"));

describe("CoverageReader", () => {
  it("reads vitest coverage-summary.json", () => {
    const repo = makeDir();
    mkdirSync(join(repo, "coverage"));
    writeFileSync(
      join(repo, "coverage", "coverage-summary.json"),
      JSON.stringify({ total: { lines: { pct: 87.5 } } }),
    );

    expect(readCoveragePct(repo)).toBe(87.5);
  });

  it("falls back to lcov.info", () => {
    const repo = makeDir();
    mkdirSync(join(repo, "coverage"));
    writeFileSync(join(repo, "coverage", "lcov.info"), "LF:10\nLH:8\n");

    expect(readCoveragePct(repo)).toBe(80);
  });

  it("returns null when no report exists", () => {
    expect(readCoveragePct(makeDir())).toBeNull();
  });
});
