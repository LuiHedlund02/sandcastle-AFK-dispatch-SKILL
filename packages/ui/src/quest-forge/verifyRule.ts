import type { VerifyRule } from "@sandcastle/protocol";

/**
 * Render a `VerifyRule` as a short, human-readable string used in chips
 * and combat saving-throw rows. Stable across kinds so a chip read alone
 * is unambiguous.
 *
 * Examples:
 *  - { kind: "command", command: "npm test" }       -> "command: npm test"
 *  - { kind: "tests", pattern: "api" }              -> "tests: api"
 *  - { kind: "tests" }                              -> "tests: all"
 *  - { kind: "file", path: "dist/main.js", true }   -> "file: dist/main.js"
 *  - { kind: "file", path: "x", false }             -> "file (gone): x"
 *  - { kind: "commits", minCount: 1 }               -> "commits: 1"
 */
export function describeVerifyRule(rule: VerifyRule): string {
  switch (rule.kind) {
    case "command":
      return `command: ${rule.command}`;
    case "tests":
      return rule.pattern ? `tests: ${rule.pattern}` : "tests: all";
    case "file":
      return rule.mustExist
        ? `file: ${rule.path}`
        : `file (gone): ${rule.path}`;
    case "commits":
      return `commits: ${rule.minCount}`;
  }
}

/**
 * Parse a single chip-style input ("kind: payload") into a VerifyRule.
 * Returns null if the input is not a recognised kind or the payload is
 * empty/invalid. Whitespace is tolerated. Kinds: command, tests, file,
 * commits. Payload semantics:
 *  - command: <shell line>
 *  - tests: <pattern>           (or "all" / empty for no pattern)
 *  - file: <path>               (mustExist: true)
 *  - file!: <path>              (mustExist: false; "must NOT exist")
 *  - commits: <integer>=0
 */
export function parseVerifyRuleString(input: string): VerifyRule | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const sepIdx = trimmed.indexOf(":");
  if (sepIdx <= 0) return null;
  const rawKind = trimmed.slice(0, sepIdx).trim().toLowerCase();
  const payload = trimmed.slice(sepIdx + 1).trim();

  if (rawKind === "command") {
    if (payload.length === 0) return null;
    return { kind: "command", command: payload };
  }
  if (rawKind === "tests") {
    if (payload.length === 0 || payload.toLowerCase() === "all") {
      return { kind: "tests" };
    }
    return { kind: "tests", pattern: payload };
  }
  if (rawKind === "file" || rawKind === "file!") {
    if (payload.length === 0) return null;
    return { kind: "file", path: payload, mustExist: rawKind === "file" };
  }
  if (rawKind === "commits") {
    const n = Number.parseInt(payload, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return { kind: "commits", minCount: n };
  }
  return null;
}

export const VERIFY_RULE_KINDS = [
  "command",
  "tests",
  "file",
  "commits",
] as const;

export type VerifyRuleKind = (typeof VERIFY_RULE_KINDS)[number];
