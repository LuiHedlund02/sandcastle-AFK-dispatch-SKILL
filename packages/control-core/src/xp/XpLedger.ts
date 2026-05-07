import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OperativeXpSummary, XpLedgerEntry } from "@sandcastle/protocol";
import type { SqliteStore } from "../telemetry/SqliteStore.js";
import {
  computeCommitPatchHashes,
  computePatchIdentityHash,
} from "./patchIdentity.js";

const execFileAsync = promisify(execFile);
const BASE_XP = 500;
const LINKED_ISSUE_BONUS = 250;
const PER_RUN_CAP = 2500;

export interface RecordMergeInput {
  readonly runId: string;
  readonly repoRoot: string;
  readonly beforeCommit: string;
  readonly afterCommit: string;
  readonly mergedIntoBranch: string;
  readonly operativeId?: string;
  readonly linkedIssueNumber?: number;
}

export class XpLedger {
  constructor(private readonly store: SqliteStore) {}

  async recordMerge(input: RecordMergeInput): Promise<number> {
    if (input.beforeCommit === input.afterCommit) return 0;
    if (
      await isMergeOnlyRange(
        input.repoRoot,
        input.beforeCommit,
        input.afterCommit,
      )
    ) {
      return 0;
    }

    const patchHash = await computePatchIdentityHash(
      input.repoRoot,
      input.beforeCommit,
      input.afterCommit,
    );
    if (!patchHash) return 0;

    const bonus = input.linkedIssueNumber ? LINKED_ISSUE_BONUS : 0;
    const existingRunXp = this.getRunXp(input.runId);
    const netXp = Math.max(
      0,
      Math.min(PER_RUN_CAP - existingRunXp, BASE_XP + bonus),
    );
    if (netXp === 0) return 0;
    const entry: XpLedgerEntry = {
      runId: input.runId,
      repoRoot: input.repoRoot,
      operativeId: input.operativeId ?? "pi-default",
      patchHash,
      baseXp: BASE_XP,
      bonus,
      penalty: 0,
      netXp,
      recordedAt: new Date().toISOString(),
      revertedAt: null,
    };

    return this.store.insertXpEntry(entry) ? netXp : 0;
  }

  async detectReverts(repoRoot: string): Promise<void> {
    const revertedAt = new Date().toISOString();
    const revertPatchHashes = await revertedPatchHashes(repoRoot);
    for (const patchHash of revertPatchHashes) {
      this.store.markXpReverted(repoRoot, patchHash, revertedAt);
    }

    const currentHashes = await computeCommitPatchHashes(repoRoot);
    for (const entry of this.store.listXpEntries({ repoRoot })) {
      if (entry.revertedAt !== null) continue;
      if (!currentHashes.has(entry.patchHash)) {
        this.store.markXpReverted(repoRoot, entry.patchHash, revertedAt);
      }
    }
  }

  getOperativeXp(operativeId: string): OperativeXpSummary {
    const entries = this.store.listXpEntries({ operativeId });
    return {
      totalXp: entries.reduce((total, entry) => total + entry.netXp, 0),
      recentRuns: entries.slice(0, 20).map((entry) => ({
        runId: entry.runId,
        netXp: entry.netXp,
        recordedAt: entry.recordedAt,
      })),
    };
  }

  getRunXp(runId: string): number {
    return this.store
      .listXpEntries({ runId })
      .reduce((total, entry) => total + entry.netXp, 0);
  }
}

const isMergeOnlyRange = async (
  repoRoot: string,
  beforeCommit: string,
  afterCommit: string,
): Promise<boolean> => {
  const commits = await git(repoRoot, [
    "rev-list",
    "--count",
    "--no-merges",
    `${beforeCommit}..${afterCommit}`,
  ]);
  return commits === "0";
};

const revertedPatchHashes = async (repoRoot: string): Promise<Set<string>> => {
  const log = await git(repoRoot, [
    "log",
    "--since=14 days ago",
    "--format=%H%x00%B%x00--END--",
  ]);
  const hashes = new Set<string>();
  for (const block of log?.split("\0--END--").filter(Boolean) ?? []) {
    const [commit, ...messageParts] = block.split("\0");
    const message = messageParts.join("\0");
    if (!commit || !/^Revert\b/im.test(message)) continue;
    const reverted = /This reverts commit ([0-9a-f]{7,40})\./i.exec(
      message,
    )?.[1];
    if (!reverted) continue;
    const parent = await git(repoRoot, ["rev-parse", `${reverted}^`]);
    if (!parent) continue;
    const hash = await computePatchIdentityHash(repoRoot, parent, reverted);
    if (hash) hashes.add(hash);
  }
  return hashes;
};

const git = async (
  cwd: string,
  args: readonly string[],
): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync("git", [...args], {
      cwd,
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
};
