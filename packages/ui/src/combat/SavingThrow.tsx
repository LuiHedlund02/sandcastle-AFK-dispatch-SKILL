import type { JSX } from "react";
import type { VerifyRuleResult } from "@sandcastle/protocol";
import { describeVerifyRule } from "../quest-forge/verifyRule.js";
import styles from "./SavingThrow.module.css";

export interface SavingThrowProps {
  readonly result: VerifyRuleResult;
  readonly className?: string;
}

/**
 * One verify-rule result rendered as a saving throw row. Pass / fail glyph
 * + the rule label (`describeVerifyRule`) + the duration the rule took to
 * evaluate. Color is reinforced by glyph + label so we never rely on color
 * alone.
 */
export function SavingThrow({
  result,
  className,
}: SavingThrowProps): JSX.Element {
  const stateCls = result.ok ? styles.pass : styles.fail;
  const cls = [styles.root, stateCls, className].filter(Boolean).join(" ");
  const glyph = result.ok ? "✓" : "✕";
  const label = describeVerifyRule(result.rule);
  const stateLabel = result.ok ? "Pass" : "Fail";
  return (
    <li
      className={cls}
      aria-label={`Saving throw ${label} — ${stateLabel}`}
      data-state={result.ok ? "pass" : "fail"}
    >
      <span className={styles.glyph} aria-hidden="true">
        {glyph}
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.duration}>
        {formatDuration(result.durationMs)}
      </span>
    </li>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
