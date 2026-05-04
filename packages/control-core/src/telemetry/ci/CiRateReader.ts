import type { GitHubClient } from "../../github/GitHubClient.js";
import type { SqliteStore } from "../SqliteStore.js";
import { readCached, writeCached } from "../cache.js";

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
  writeCached(options?.store, repoRoot, DOMAIN, githubRate);
  return githubRate;
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
