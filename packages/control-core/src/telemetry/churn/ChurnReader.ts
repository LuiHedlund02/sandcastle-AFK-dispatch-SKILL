import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SqliteStore } from "../SqliteStore.js";
import { readCached, writeCached } from "../cache.js";

const execFileAsync = promisify(execFile);
const DOMAIN = "churn";

export const readChurnScore = async (
  repoRoot: string,
  store?: SqliteStore,
): Promise<number | null> => {
  const cached = readCached<number | null>(store, repoRoot, DOMAIN);
  if (cached !== undefined) return cached;

  const log = await git(repoRoot, [
    "log",
    "--since=30 days ago",
    "--name-only",
    "--pretty=format:--COMMIT--",
  ]);
  if (!log) {
    writeCached(store, repoRoot, DOMAIN, null);
    return null;
  }

  const commits: string[][] = [];
  let current: string[] = [];
  for (const line of log.split(/\r?\n/)) {
    if (line === "--COMMIT--") {
      if (current.length > 0) commits.push([...new Set(current)]);
      current = [];
      continue;
    }
    if (line.trim()) current.push(line.trim());
  }
  if (current.length > 0) commits.push([...new Set(current)]);
  if (commits.length === 0) {
    writeCached(store, repoRoot, DOMAIN, null);
    return null;
  }

  const filesPerCommit = commits
    .map((files) => files.length)
    .sort((a, b) => a - b);
  const fileTouches = new Map<string, number>();
  for (const files of commits) {
    for (const file of files)
      fileTouches.set(file, (fileTouches.get(file) ?? 0) + 1);
  }
  const score = Math.min(
    1000,
    Math.round(median(filesPerCommit) * Math.max(...fileTouches.values())),
  );
  writeCached(store, repoRoot, DOMAIN, score);
  return score;
};

const median = (values: readonly number[]): number => {
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2
    : (values[mid] ?? 0);
};

const git = async (
  cwd: string,
  args: readonly string[],
): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("git", [...args], {
      cwd,
      timeout: 5000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
};
