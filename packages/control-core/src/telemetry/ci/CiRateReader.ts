import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitHubClient } from "../../github/GitHubClient.js";
import type { SqliteStore } from "../SqliteStore.js";
import { readCached, writeCached } from "../cache.js";

const execFileAsync = promisify(execFile);
const DOMAIN = "ci";

interface WorkflowRunsResponse {
  readonly workflow_runs?: Array<{ readonly conclusion: string | null }>;
}

export const readCiGreenRate30d = async (
  repoRoot: string,
  options?: {
    readonly store?: SqliteStore;
    readonly github?: GitHubClient;
  },
): Promise<number | null> => {
  const cached = readCached<number | null>(options?.store, repoRoot, DOMAIN);
  if (cached !== undefined) return cached;

  const githubRate = options?.github
    ? await readGitHubCiRate(options.github)
    : null;
  const value = githubRate ?? (await readLocalCiHeuristic(repoRoot));
  writeCached(options?.store, repoRoot, DOMAIN, value);
  return value;
};

const readGitHubCiRate = async (
  github: GitHubClient,
): Promise<number | null> => {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const response = await github.requestJson<WorkflowRunsResponse>(
    "/repos/:owner/:repo/actions/runs",
    {
      status: "completed",
      created: `>=${since}`,
      per_page: "100",
    },
  );
  const runs = response?.data.workflow_runs ?? [];
  if (runs.length === 0) return null;
  const successes = runs.filter((run) => run.conclusion === "success").length;
  return Math.round((successes / runs.length) * 10_000) / 100;
};

const readLocalCiHeuristic = async (
  repoRoot: string,
): Promise<number | null> => {
  const log = await git(repoRoot, [
    "log",
    "--since=30 days ago",
    "--pretty=%s",
  ]);
  if (!log) return null;
  const ciCommits = log
    .split(/\r?\n/)
    .filter((subject) => /\[ci\]|^chore\(ci\)/i.test(subject));
  if (ciCommits.length === 0) return null;
  const reverts = ciCommits.filter((subject) =>
    /^revert/i.test(subject),
  ).length;
  return (
    Math.round(((ciCommits.length - reverts) / ciCommits.length) * 10_000) / 100
  );
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
