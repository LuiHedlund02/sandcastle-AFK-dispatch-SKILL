import type { JSX } from "react";
import { useId, useState } from "react";
import type { ParsedPhase, VerifyRule } from "@sandcastle/protocol";
import { describeVerifyRule, parseVerifyRuleString } from "./verifyRule.js";
import styles from "./PhaseEditorCard.module.css";

export interface PhaseEditorCardProps {
  readonly phase: ParsedPhase;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly onChange: (next: ParsedPhase) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onDelete: () => void;
  readonly className?: string;
}

/**
 * One editable phase card. Supports:
 *  - title input  (max 60 chars; truncated for display)
 *  - objective textarea
 *  - verify-rule chip multi-input via a free-text "kind: payload" parser
 *    (e.g. "command: npm test", "tests: api", "file: dist/main.js",
 *    "commits: 1"). Invalid rules surface an inline error string instead
 *    of silently dropping; consumers see only valid rules.
 *  - reorder up/down + delete actions, gated by canMoveUp/canMoveDown.
 *
 * Pure controlled component. All edits flow through `onChange(nextPhase)`;
 * no internal phase state. The chip free-text input is the only piece of
 * local state (the in-progress chip text).
 */
export function PhaseEditorCard({
  phase,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  className,
}: PhaseEditorCardProps): JSX.Element {
  const ruleInputId = useId();
  const [pending, setPending] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const cls = [styles.root, className].filter(Boolean).join(" ");

  const updateTitle = (raw: string) => {
    // Protocol requires title.max(60). Trim hard so we never produce an
    // invalid ParsedPhase via the editor.
    const next = raw.slice(0, 60);
    onChange({ ...phase, title: next });
  };

  const updateObjective = (raw: string) => {
    onChange({ ...phase, objective: raw });
  };

  const submitRule = () => {
    const parsed = parseVerifyRuleString(pending);
    if (!parsed) {
      setError(
        "Use kind: payload — command:, tests:, file: <path>, commits: N",
      );
      return;
    }
    setError(null);
    setPending("");
    onChange({
      ...phase,
      verifyRules: [...phase.verifyRules, parsed],
    });
  };

  const removeRule = (index: number) => {
    onChange({
      ...phase,
      verifyRules: phase.verifyRules.filter((_, i) => i !== index),
    });
  };

  return (
    <article
      className={cls}
      aria-label={`Phase ${phase.ordinal}: ${phase.title}`}
    >
      <header className={styles.head}>
        <span className={styles.ord} aria-hidden="true">
          {phase.ordinal}
        </span>
        <input
          aria-label={`Phase ${phase.ordinal} title`}
          className={styles["title-input"]}
          value={phase.title}
          onChange={(e) => updateTitle(e.target.value)}
          spellCheck={false}
          maxLength={60}
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move phase ${phase.ordinal} up`}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move phase ${phase.ordinal} down`}
          >
            ↓
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles["action-delete"]}`}
            onClick={onDelete}
            aria-label={`Delete phase ${phase.ordinal}`}
          >
            ×
          </button>
        </div>
      </header>

      <label className={styles.label}>
        <span className={styles["label-text"]}>Objective</span>
        <input
          aria-label={`Phase ${phase.ordinal} objective`}
          className={styles["objective-input"]}
          value={phase.objective}
          onChange={(e) => updateObjective(e.target.value)}
          spellCheck={false}
        />
      </label>

      <section className={styles.rules} aria-label="Verify rules">
        <span className={styles["label-text"]}>
          Verify rules · {phase.verifyRules.length}
        </span>
        {phase.verifyRules.length > 0 ? (
          <ul className={styles.chips}>
            {phase.verifyRules.map((rule, i) => (
              <VerifyRuleChip
                key={`${rule.kind}-${i}`}
                rule={rule}
                onRemove={() => removeRule(i)}
              />
            ))}
          </ul>
        ) : null}

        <div className={styles["rule-form"]}>
          <input
            id={ruleInputId}
            aria-label={`Add verify rule to phase ${phase.ordinal}`}
            className={styles["rule-input"]}
            value={pending}
            placeholder="command: npm test  ·  tests: api  ·  file: dist/main.js  ·  commits: 1"
            onChange={(e) => {
              setPending(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitRule();
              }
            }}
            spellCheck={false}
          />
          <button
            type="button"
            className={styles["rule-add"]}
            onClick={submitRule}
            disabled={pending.trim().length === 0}
          >
            Add
          </button>
        </div>
        {error ? (
          <p className={styles["rule-error"]} role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.hint}>
            Press Enter to add. Use <code>file!: path</code> for
            "must-not-exist".
          </p>
        )}
      </section>
    </article>
  );
}

function VerifyRuleChip({
  rule,
  onRemove,
}: {
  readonly rule: VerifyRule;
  readonly onRemove: () => void;
}): JSX.Element {
  return (
    <li className={styles.chip}>
      <span className={styles["chip-kind"]}>{rule.kind}</span>
      <span>{describeVerifyRule(rule).replace(/^\w+(?:!)?:\s*/, "")}</span>
      <button
        type="button"
        className={styles["chip-remove"]}
        onClick={onRemove}
        aria-label={`Remove verify rule ${describeVerifyRule(rule)}`}
      >
        ×
      </button>
    </li>
  );
}
