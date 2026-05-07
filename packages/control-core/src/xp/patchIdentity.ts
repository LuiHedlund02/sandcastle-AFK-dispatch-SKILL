import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const hashCanonicalDiff = (diff: string): string | null => {
  const canonical = canonicalizeDiff(diff);
  if (!canonical) return null;
  return createHash("sha256").update(canonical).digest("hex");
};

export const computePatchIdentityHash = async (
  repoRoot: string,
  beforeCommit: string,
  afterCommit: string,
): Promise<string | null> => {
  const diff = await git(repoRoot, [
    "diff",
    "--ignore-all-space",
    "--ignore-blank-lines",
    "--no-ext-diff",
    "--no-renames",
    beforeCommit,
    afterCommit,
  ]);
  return diff === null ? null : hashCanonicalDiff(diff);
};

export const computeCommitPatchHashes = async (
  repoRoot: string,
  since?: string,
): Promise<Set<string>> => {
  const commits = await git(repoRoot, [
    "log",
    "--no-merges",
    ...(since ? [`--since=${since}`] : []),
    "--format=%H",
  ]);
  const hashes = new Set<string>();
  for (const commit of commits?.split(/\r?\n/).filter(Boolean) ?? []) {
    const parent = await git(repoRoot, ["rev-parse", `${commit}^`]);
    if (!parent) continue;
    const hash = await computePatchIdentityHash(repoRoot, parent, commit);
    if (hash) hashes.add(hash);
  }
  return hashes;
};

const canonicalizeDiff = (diff: string): string | null => {
  const lines: string[] = [];
  for (const rawLine of diff.split(/\r?\n/)) {
    if (!rawLine) continue;
    if (
      rawLine.startsWith("index ") ||
      rawLine.startsWith("old mode ") ||
      rawLine.startsWith("new mode ") ||
      rawLine.startsWith("deleted file mode ") ||
      rawLine.startsWith("new file mode ")
    ) {
      continue;
    }
    if (rawLine.startsWith("\\ No newline at end of file")) continue;
    if (rawLine.startsWith("@@")) {
      lines.push(rawLine.replace(/\s+/g, " ").trim());
      continue;
    }
    const marker = rawLine[0];
    if (marker === "+" || marker === "-" || marker === " ") {
      const body = rawLine.slice(1).trim();
      if (body) lines.push(`${marker}${body}`);
      continue;
    }
    lines.push(rawLine.trim());
  }
  return lines.length > 0 ? lines.join("\n") : null;
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
