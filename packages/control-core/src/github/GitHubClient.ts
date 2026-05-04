import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseGitRemote, type GitHubRemote } from "./parseGitRemote.js";

const execFileAsync = promisify(execFile);

export interface GitHubClientOptions {
  readonly repoRoot: string;
  readonly fetchImpl?: typeof fetch;
  readonly token?: string | null;
}

export interface GitHubResponse<T> {
  readonly data: T;
  readonly headers: Headers;
}

export class GitHubClient {
  private readonly cache = new Map<string, GitHubResponse<unknown>>();
  private resolvedToken: string | null | undefined;

  constructor(private readonly options: GitHubClientOptions) {}

  async getRemote(): Promise<GitHubRemote | null> {
    const remote = await git(this.options.repoRoot, [
      "remote",
      "get-url",
      "origin",
    ]);
    return parseGitRemote(remote);
  }

  async requestJson<T>(
    path: string,
    query?: Record<string, string>,
  ): Promise<GitHubResponse<T> | null> {
    try {
      const remote = await this.getRemote();
      if (!remote) return null;
      const token = await this.getToken();
      if (!token) return null;

      const url = this.buildApiUrl(remote, path, query);
      const key = url.toString();
      const response = await (this.options.fetchImpl ?? fetch)(url, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
        },
      });

      if (isRateLimited(response)) {
        return (this.cache.get(key) as GitHubResponse<T> | undefined) ?? null;
      }
      if (!response.ok) return null;

      const data = (await response.json()) as T;
      const result = { data, headers: response.headers };
      this.cache.set(key, result);
      return result;
    } catch {
      return null;
    }
  }

  private async getToken(): Promise<string | null> {
    if (this.resolvedToken !== undefined) return this.resolvedToken;
    this.resolvedToken =
      this.options.token ?? process.env.GITHUB_TOKEN ?? (await ghAuthToken());
    return this.resolvedToken;
  }

  private buildApiUrl(
    remote: GitHubRemote,
    path: string,
    query?: Record<string, string>,
  ): URL {
    const apiHost =
      remote.host === "github.com" ? "api.github.com" : `${remote.host}/api/v3`;
    const url = new URL(
      `https://${apiHost}${path
        .replace(":owner", encodeURIComponent(remote.owner))
        .replace(":repo", encodeURIComponent(remote.repo))}`,
    );
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    return url;
  }
}

const isRateLimited = (response: Response): boolean =>
  (response.status === 403 || response.status === 429) &&
  response.headers.get("x-ratelimit-remaining") === "0";

const ghAuthToken = async (): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"], {
      timeout: 5000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
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
