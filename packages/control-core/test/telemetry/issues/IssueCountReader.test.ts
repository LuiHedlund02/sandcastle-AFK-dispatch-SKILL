import { describe, expect, it } from "vitest";
import type { GitHubClient } from "../../../src/github/GitHubClient.js";
import { readOpenIssueCount } from "../../../src/telemetry/issues/IssueCountReader.js";

describe("IssueCountReader", () => {
  it("reads open issue count from GitHub pagination", async () => {
    const headers = new Headers({
      link: '<https://api.github.com/repos/o/r/issues?page=47>; rel="last"',
    });
    const github = {
      requestJson: async () => ({ data: [{}], headers }),
    } as unknown as GitHubClient;

    await expect(readOpenIssueCount("C:/repo", { github })).resolves.toBe(47);
  });

  it("returns null when GitHub issues are unavailable", async () => {
    const github = {
      requestJson: async () => null,
    } as unknown as GitHubClient;

    await expect(readOpenIssueCount("C:/repo", { github })).resolves.toBeNull();
  });
});
