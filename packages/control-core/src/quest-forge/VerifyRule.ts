import {
  zVerifyRule,
  zVerifyRuleResult,
  type VerifyRule,
  type VerifyRuleResult,
} from "@sandcastle/protocol";

export { zVerifyRule, zVerifyRuleResult };
export type { VerifyRule, VerifyRuleResult };

export const describeVerifyRule = (rule: VerifyRule): string => {
  switch (rule.kind) {
    case "command":
      return `command:${rule.command}`;
    case "tests":
      return `tests:${rule.pattern ?? "all"}`;
    case "file":
      return `file:${rule.mustExist ? "exists" : "absent"}:${rule.path}`;
    case "commits":
      return `commits:min:${rule.minCount}`;
  }
};
