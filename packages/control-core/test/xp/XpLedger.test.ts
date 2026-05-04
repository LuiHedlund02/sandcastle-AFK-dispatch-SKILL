import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteStore } from "../../src/telemetry/SqliteStore.js";
import { XpLedger } from "../../src/xp/XpLedger.js";
import { makeRepo } from "../helpers.js";

const head = (repo: string): string =>
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();

const commitFile = (repo: string, file: string, content: string): string => {
  writeFileSync(join(repo, file), content);
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-m", `feat: ${file}`], {
    cwd: repo,
    stdio: "ignore",
  });
  return head(repo);
};

const withLedger =
  <T>(fn: (repo: string, ledger: XpLedger, store: SqliteStore) => Promise<T>) =>
  async (): Promise<T> => {
    const repo = makeRepo();
    const store = new SqliteStore(repo);
    try {
      return await fn(repo, new XpLedger(store), store);
    } finally {
      store.close();
    }
  };

describe("XpLedger", () => {
  it(
    "recordMerge stores patch hash and base XP",
    withLedger(async (repo, ledger, store) => {
      const before = head(repo);
      const after = commitFile(repo, "a.ts", "export const a = 1;\n");

      await expect(
        ledger.recordMerge({
          runId: "run-a",
          repoRoot: repo,
          beforeCommit: before,
          afterCommit: after,
          mergedIntoBranch: "main",
          operativeId: "op-a",
        }),
      ).resolves.toBe(500);
      expect(store.listXpEntries({ runId: "run-a" })[0]).toMatchObject({
        baseXp: 500,
        netXp: 500,
        operativeId: "op-a",
      });
    }),
  );

  it(
    "rejects duplicate patch hashes",
    withLedger(async (repo, ledger) => {
      const before = head(repo);
      const after = commitFile(repo, "a.ts", "export const a = 1;\n");
      const input = {
        runId: "run-a",
        repoRoot: repo,
        beforeCommit: before,
        afterCommit: after,
        mergedIntoBranch: "main",
      };

      await expect(ledger.recordMerge(input)).resolves.toBe(500);
      await expect(
        ledger.recordMerge({ ...input, runId: "run-b" }),
      ).resolves.toBe(0);
    }),
  );

  it(
    "detectReverts zeros reverted entries",
    withLedger(async (repo, ledger, store) => {
      const before = head(repo);
      const after = commitFile(repo, "a.ts", "export const a = 1;\n");
      await ledger.recordMerge({
        runId: "run-a",
        repoRoot: repo,
        beforeCommit: before,
        afterCommit: after,
        mergedIntoBranch: "main",
      });
      execFileSync("git", ["revert", "--no-edit", after], { cwd: repo });

      await ledger.detectReverts(repo);

      expect(store.listXpEntries({ runId: "run-a" })[0]).toMatchObject({
        netXp: 0,
      });
      expect(
        store.listXpEntries({ runId: "run-a" })[0]?.revertedAt,
      ).not.toBeNull();
    }),
  );

  it(
    "detectReverts zeros patch hashes missing from git log",
    withLedger(async (repo, ledger, store) => {
      store.insertXpEntry({
        runId: "run-missing",
        repoRoot: repo,
        operativeId: "op-a",
        patchHash: "missing",
        baseXp: 500,
        bonus: 0,
        penalty: 0,
        netXp: 500,
        recordedAt: new Date().toISOString(),
        revertedAt: null,
      });

      await ledger.detectReverts(repo);

      expect(store.listXpEntries({ runId: "run-missing" })[0]).toMatchObject({
        netXp: 0,
      });
    }),
  );

  it(
    "enforces the per-run cap",
    withLedger(async (repo, ledger) => {
      let before = head(repo);
      let total = 0;
      for (let index = 0; index < 6; index++) {
        const after = commitFile(
          repo,
          `file-${index}.ts`,
          `export const v = ${index};\n`,
        );
        total += await ledger.recordMerge({
          runId: "run-cap",
          repoRoot: repo,
          beforeCommit: before,
          afterCommit: after,
          mergedIntoBranch: "main",
        });
        before = after;
      }

      expect(total).toBe(2500);
      expect(ledger.getRunXp("run-cap")).toBe(2500);
    }),
  );

  it(
    "adds linked issue bonus",
    withLedger(async (repo, ledger) => {
      const before = head(repo);
      const after = commitFile(
        repo,
        "issue.ts",
        "export const issue = true;\n",
      );

      await expect(
        ledger.recordMerge({
          runId: "run-issue",
          repoRoot: repo,
          beforeCommit: before,
          afterCommit: after,
          mergedIntoBranch: "main",
          linkedIssueNumber: 123,
        }),
      ).resolves.toBe(750);
    }),
  );
});
