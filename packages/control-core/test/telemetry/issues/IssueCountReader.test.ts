import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GitHubClient } from "../../../src/github/GitHubClient.js";
import {
  readOpenIssueCount,
  readTodoFixmeFallback,
} from "../../../src/telemetry/issues/IssueCountReader.js";

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

  it("counts TODO and FIXME markers as local fallback", () => {
    const repo = mkdtempSync(join(tmpdir(), "sandcastle-issues-"));
    mkdirSync(join(repo, "src"));
    writeFileSync(join(repo, "src", "a.ts"), "// TODO: one\n// FIXME: two\n");
    mkdirSync(join(repo, "dist"));
    writeFileSync(join(repo, "dist", "ignored.ts"), "// TODO: ignored\n");

    expect(readTodoFixmeFallback(repo)).toBe(2);
  });
});
