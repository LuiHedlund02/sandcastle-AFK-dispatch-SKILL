import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readChurnScore } from "../../../src/telemetry/churn/ChurnReader.js";

const makeChurnRepo = (): string => {
  const repo = mkdtempSync(join(tmpdir(), "sandcastle-churn-"));
  execFileSync("git", ["init", "-b", "main"], { cwd: repo, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repo,
  });
  mkdirSync(join(repo, "src"));
  const commit = (message: string) => {
    execFileSync("git", ["add", "."], { cwd: repo });
    execFileSync("git", ["commit", "-m", message], {
      cwd: repo,
      stdio: "ignore",
    });
  };
  writeFileSync(join(repo, "src", "a.ts"), "a1\n");
  commit("feat: a1");
  writeFileSync(join(repo, "src", "a.ts"), "a2\n");
  writeFileSync(join(repo, "src", "b.ts"), "b1\n");
  commit("feat: a2 b1");
  writeFileSync(join(repo, "src", "a.ts"), "a3\n");
  commit("feat: a3");
  writeFileSync(join(repo, "src", "b.ts"), "b2\n");
  commit("feat: b2");
  writeFileSync(join(repo, "src", "a.ts"), "a4\n");
  commit("feat: a4");
  return repo;
};

describe("ChurnReader", () => {
  it("produces a deterministic score from git log", async () => {
    await expect(readChurnScore(makeChurnRepo())).resolves.toBe(4);
  });
});
