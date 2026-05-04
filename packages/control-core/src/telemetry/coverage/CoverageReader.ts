import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteStore } from "../SqliteStore.js";
import { readCached, writeCached } from "../cache.js";

const DOMAIN = "coverage";

export const readCoveragePct = (
  repoRoot: string,
  store?: SqliteStore,
): number | null => {
  const cached = readCached<number | null>(store, repoRoot, DOMAIN);
  if (cached !== undefined) return cached;

  const summaryPath = join(repoRoot, "coverage", "coverage-summary.json");
  const lcovPath = join(repoRoot, "coverage", "lcov.info");
  const value = existsSync(summaryPath)
    ? readVitestSummary(summaryPath)
    : existsSync(lcovPath)
      ? readLcov(lcovPath)
      : null;
  writeCached(store, repoRoot, DOMAIN, value);
  return value;
};

const readVitestSummary = (path: string): number | null => {
  const json = JSON.parse(readFileSync(path, "utf8")) as {
    total?: { lines?: { pct?: unknown } };
  };
  const pct = json.total?.lines?.pct;
  return typeof pct === "number" && Number.isFinite(pct) ? pct : null;
};

const readLcov = (path: string): number | null => {
  let found = 0;
  let hit = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.startsWith("LF:")) found += Number(line.slice(3)) || 0;
    if (line.startsWith("LH:")) hit += Number(line.slice(3)) || 0;
  }
  if (found === 0) return null;
  return Math.round((hit / found) * 10_000) / 100;
};
