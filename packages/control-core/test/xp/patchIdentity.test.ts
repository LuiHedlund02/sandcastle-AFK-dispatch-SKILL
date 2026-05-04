import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computePatchIdentityHash } from "../../src/xp/patchIdentity.js";
import { makeRepo } from "../helpers.js";

const commitAll = (repo: string, message: string): string => {
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-m", message], {
    cwd: repo,
    stdio: "ignore",
  });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo })
    .toString()
    .trim();
};

describe("patchIdentity", () => {
  it("excludes whitespace-only changes", async () => {
    const repo = makeRepo();
    const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo })
      .toString()
      .trim();
    writeFileSync(join(repo, "README.md"), "# test   \n");
    const after = commitAll(repo, "style: whitespace");

    await expect(
      computePatchIdentityHash(repo, before, after),
    ).resolves.toBeNull();
  });

  it("hashes identical content edits identically across repos", async () => {
    const first = makeRepo();
    const second = makeRepo();
    const beforeFirst = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: first,
    })
      .toString()
      .trim();
    const beforeSecond = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: second,
    })
      .toString()
      .trim();
    writeFileSync(join(first, "feature.ts"), "export const value = 1;\n");
    writeFileSync(join(second, "feature.ts"), "export const value = 1;\n");
    const afterFirst = commitAll(first, "feat: add feature");
    const afterSecond = commitAll(second, "feat: add feature");

    await expect(
      computePatchIdentityHash(first, beforeFirst, afterFirst),
    ).resolves.toBe(
      await computePatchIdentityHash(second, beforeSecond, afterSecond),
    );
  });
});
