import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../../src/github/GitHubClient.js";
import { makeRepo } from "../helpers.js";

describe("GitHubClient", () => {
  it("requests GitHub REST JSON for the repo remote", async () => {
    const repo = makeRepo();
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://github.com/o/r.git"],
      {
        cwd: repo,
      },
    );
    const seen: string[] = [];
    const client = new GitHubClient({
      repoRoot: repo,
      token: "token",
      fetchImpl: (async (url: Parameters<typeof fetch>[0]) => {
        seen.push(String(url));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    await expect(
      client.requestJson("/repos/:owner/:repo/issues"),
    ).resolves.toMatchObject({ data: { ok: true } });
    expect(seen[0]).toBe("https://api.github.com/repos/o/r/issues");
  });

  it("returns cached data when rate limited", async () => {
    const repo = makeRepo();
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://github.com/o/r.git"],
      {
        cwd: repo,
      },
    );
    let calls = 0;
    const client = new GitHubClient({
      repoRoot: repo,
      token: "token",
      fetchImpl: (async () => {
        calls++;
        if (calls === 1) {
          return new Response(JSON.stringify({ value: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ message: "rate limited" }), {
          status: 403,
          headers: { "x-ratelimit-remaining": "0" },
        });
      }) as typeof fetch,
    });

    await expect(
      client.requestJson("/repos/:owner/:repo/issues"),
    ).resolves.toMatchObject({ data: { value: 1 } });
    await expect(
      client.requestJson("/repos/:owner/:repo/issues"),
    ).resolves.toMatchObject({ data: { value: 1 } });
  });
});
