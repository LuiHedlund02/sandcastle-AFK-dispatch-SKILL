import type { JSX } from "react";
import type {
  Phase,
  Run,
  RunStatus,
  VerifyRule,
  VerifyRuleResult,
} from "@sandcastle/protocol";
import { describeVerifyRule } from "../quest-forge/verifyRule.js";
import styles from "./CombatHud.module.css";

export type VerifyRuleHudState = "pass" | "fail" | "pending";

export interface CombatHudVerifyEntry {
  readonly rule: VerifyRule;
  readonly state: VerifyRuleHudState;
}

export interface CombatHudProps {
  readonly run: Run;
  readonly phases: readonly Phase[];
  /** Per-rule HUD state. Pass `pass` for verified rules in the run, `fail`
   * for any rule that failed in the most recent verification, and `pending`
   * for rules not yet evaluated. Consumers compute this from
   * phase.verified / phase.failed events plus the parsed phases. */
  readonly verifyEntries?: readonly CombatHudVerifyEntry[];
  readonly className?: string;
}

const VICTORY: ReadonlySet<RunStatus> = new Set(["victory", "win-pending"]);
const DEFEAT: ReadonlySet<RunStatus> = new Set(["defeat", "fail-pending"]);

/**
 * Sticky right-side dossier for the combat skin. Phases-complete bar across
 * the top, then a list of every verify rule across the run with its current
 * pass/fail/pending glyph, then a big VICTORY / DEFEAT / PENDING callout
 * that appears once the run resolves.
 *
 * Color is paired with text labels and glyphs throughout — never a sole
 * signal.
 */
export function CombatHud({
  run,
  phases,
  verifyEntries,
  className,
}: CombatHudProps): JSX.Element {
  const total = phases.length;
  const verified = phases.filter((p) => p.status === "verified").length;
  const pct = total === 0 ? 0 : Math.round((verified / total) * 100);

  const entries = verifyEntries ?? deriveEntries(phases);

  let calloutClass = styles["callout-pending"];
  let calloutLabel = "Pending";
  let calloutSub = "Run still in flight.";
  if (VICTORY.has(run.status)) {
    calloutClass = styles["callout-victory"];
    calloutLabel = run.status === "victory" ? "Victory" : "Win pending";
    calloutSub = "All saving throws held.";
  } else if (DEFEAT.has(run.status)) {
    calloutClass = styles["callout-defeat"];
    calloutLabel = run.status === "defeat" ? "Defeat" : "Fail pending";
    calloutSub =
      run.verification.failedChecks.length > 0
        ? run.verification.failedChecks.join(", ")
        : "Verification reported failures.";
  } else if (run.status === "aborted") {
    calloutClass = styles["callout-defeat"];
    calloutLabel = "Aborted";
    calloutSub = "Run cancelled mid-flight.";
  }

  const cls = [styles.root, className].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      <div className={styles["bar-wrap"]} aria-label="Phases verified">
        <div className={styles["bar-row"]}>
          <span>HP · phases verified</span>
          <span className="v">
            {verified}/{total}
          </span>
        </div>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={styles.rules}>
        <h4 className={styles["rules-head"]}>Saving throws · all rounds</h4>
        {entries.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--sc-mono)",
              fontSize: 10.5,
              color: "var(--sc-steel)",
            }}
          >
            No verify rules pinned.
          </p>
        ) : (
          <ul className={styles["rules-list"]}>
            {entries.map((entry, i) => (
              <li
                key={`hud-rule-${i}`}
                className="rule"
                data-state={entry.state}
                aria-label={`${describeVerifyRule(entry.rule)} — ${entry.state}`}
              >
                <span className={styles["rule-glyph"]} aria-hidden="true">
                  {entry.state === "pass"
                    ? "✓"
                    : entry.state === "fail"
                      ? "✕"
                      : "?"}
                </span>
                <span>{describeVerifyRule(entry.rule)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={`${styles.callout} ${calloutClass}`}
        role="status"
        aria-label={`Run outcome: ${calloutLabel}`}
        data-callout={calloutLabel.toLowerCase().replace(/\s+/g, "-")}
      >
        {calloutLabel}
        <span className={styles["callout-sub"]}>{calloutSub}</span>
      </div>
    </div>
  );
}

function deriveEntries(
  phases: readonly Phase[],
): readonly CombatHudVerifyEntry[] {
  const out: CombatHudVerifyEntry[] = [];
  for (const phase of phases) {
    for (const rule of phase.verifyRules) {
      out.push({
        rule,
        state:
          phase.status === "verified"
            ? "pass"
            : phase.status === "failed"
              ? "fail"
              : "pending",
      });
    }
  }
  return out;
}

export function buildVerifyEntriesFromResults(
  phases: readonly Phase[],
  resultsByPhaseId: Readonly<Record<string, readonly VerifyRuleResult[]>>,
): readonly CombatHudVerifyEntry[] {
  const out: CombatHudVerifyEntry[] = [];
  for (const phase of phases) {
    const results = resultsByPhaseId[phase.id] ?? [];
    for (let i = 0; i < phase.verifyRules.length; i += 1) {
      const rule = phase.verifyRules[i]!;
      const r = results[i];
      const state: VerifyRuleHudState = r
        ? r.ok
          ? "pass"
          : "fail"
        : phase.status === "verified"
          ? "pass"
          : phase.status === "failed"
            ? "fail"
            : "pending";
      out.push({ rule, state });
    }
  }
  return out;
}
