import type { GitHubClient } from "../../github/GitHubClient.js";
import type { SqliteStore } from "../SqliteStore.js";
import { readCached, writeCached } from "../cache.js";

const DOMAIN = "issues";

export const readOpenIssueCount = async (
  repoRoot: string,
  options?: {
    readonly store?: SqliteStore;
    readonly github?: GitHubClient;
  },
): Promise<number | null> => {
  const cached = readCached<number | null>(options?.store, repoRoot, DOMAIN);
  if (cached !== undefined) return cached;

  const githubCount = options?.github
    ? await readGitHubOpenIssueCount(options.github)
    : null;
  writeCached(options?.store, repoRoot, DOMAIN, githubCount);
  return githubCount;
};

const readGitHubOpenIssueCount = async (
  github: GitHubClient,
): Promise<number | null> => {
  const response = await github.requestJson<unknown[]>(
    "/repos/:owner/:repo/issues",
    { state: "open", per_page: "1" },
  );
  if (!response) return null;
  const fromLink = countFromLinkHeader(response.headers.get("link"));
  return fromLink ?? response.data.length;
};

const countFromLinkHeader = (link: string | null): number | null => {
  if (!link) return null;
  const last = link
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel="last"/.test(part));
  if (!last) return null;
  const urlMatch = /<([^>]+)>/.exec(last);
  if (!urlMatch) return null;
  const page = new URL(urlMatch[1]!).searchParams.get("page");
  const count = page ? Number(page) : NaN;
  return Number.isFinite(count) ? count : null;
};
