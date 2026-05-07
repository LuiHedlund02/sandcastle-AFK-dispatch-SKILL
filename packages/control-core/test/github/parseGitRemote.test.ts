import { describe, expect, it } from "vitest";
import { parseGitRemote } from "../../src/github/parseGitRemote.js";

describe("parseGitRemote", () => {
  it.each([
    ["git@github.com:owner/repo.git", "github.com", "owner", "repo"],
    ["git@github.com:owner/repo", "github.com", "owner", "repo"],
    ["https://github.com/owner/repo.git", "github.com", "owner", "repo"],
    ["https://github.com/owner/repo", "github.com", "owner", "repo"],
    [
      "git@github.enterprise.local:team/project.git",
      "github.enterprise.local",
      "team",
      "project",
    ],
    [
      "https://github.enterprise.local/team/project",
      "github.enterprise.local",
      "team",
      "project",
    ],
  ])("parses %s", (remote, host, owner, repo) => {
    expect(parseGitRemote(remote)).toEqual({ host, owner, repo });
  });

  it.each([
    "",
    "not-a-url",
    "https://example.com/only-owner",
    "ftp://github.com/a/b",
  ])("returns null for malformed remote %s", (remote) => {
    expect(parseGitRemote(remote)).toBeNull();
  });
});
