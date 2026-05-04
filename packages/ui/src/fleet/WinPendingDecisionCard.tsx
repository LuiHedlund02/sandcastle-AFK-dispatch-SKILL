import type { JSX } from "react";
import { Check, GitMerge, RefreshCcw, Trash2 } from "lucide-react";
import type { Run, RunDecisionKind } from "@sandcastle/protocol";
import { OctaPanel } from "../layout/OctaPanel.js";
import styles from "./WinPendingDecisionCard.module.css";

export interface WinPendingDecisionCardProps {
  readonly run: Run;
  readonly onDecide: (kind: RunDecisionKind) => void;
  /** When true, all buttons are disabled (mid-mutation). */
  readonly pending?: boolean;
  readonly className?: string;
}

/**
 * Mini decision card surfaced when a run reaches `win-pending` or
 * `fail-pending`. Inline / always-visible — sits below the dock cell that
 * owns it. The primitive does not know about routing or APIs; the consumer
 * wires `onDecide` to a mutation.
 *
 * For win-pending: Merge / Revise / Discard.
 * For fail-pending: Revise / Discard (no Merge).
 *
 * Tone variants come from OctaPanel — green/plasma for win-pending, amber
 * for fail-pending. Status info is conveyed by both color and text label so
 * we never rely on color alone.
 */
export function WinPendingDecisionCard({
  run,
  onDecide,
  pending = false,
  className,
}: WinPendingDecisionCardProps): JSX.Element | null {
  if (run.status !== "win-pending" && run.status !== "fail-pending") {
    return null;
  }
  const isWin = run.status === "win-pending";
  const tone = isWin ? "plasma" : "amber";
  const cls = [styles.root, className].filter(Boolean).join(" ");
  const label = isWin
    ? "Win pending — verification all green"
    : "Fail pending — verification reported failures";

  return (
    <OctaPanel
      tone={tone}
      size="sm"
      className={cls}
      role="region"
      aria-label={`Decision card for run ${run.id}`}
      eyebrow={
        <span className={styles.eyebrow}>
          <span aria-hidden="true" className={styles.dot} />
          {label}
        </span>
      }
    >
      <div className={styles.body}>
        <p className={styles.directive} title={run.directive}>
          {run.directive}
        </p>
        <p className={styles.meta}>
          <span>{run.id}</span>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <span>{run.branch}</span>
        </p>

        {isWin ? (
          <p className={styles.checks}>
            <Check size={12} aria-hidden="true" /> all checks green
          </p>
        ) : (
          <ul className={styles.failedChecks} aria-label="Failed checks">
            {run.verification.failedChecks.length === 0 ? (
              <li>verification reported failures</li>
            ) : (
              run.verification.failedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))
            )}
          </ul>
        )}

        <div className={styles.actions}>
          {isWin ? (
            <button
              type="button"
              className={`${styles.button} ${styles["button-merge"]}`}
              onClick={() => onDecide("merge")}
              disabled={pending}
              aria-disabled={pending}
            >
              <GitMerge size={13} aria-hidden="true" />
              Merge
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.button} ${styles["button-revise"]}`}
            onClick={() => onDecide("revise")}
            disabled={pending}
            aria-disabled={pending}
          >
            <RefreshCcw size={13} aria-hidden="true" />
            Revise
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles["button-discard"]}`}
            onClick={() => onDecide("discard")}
            disabled={pending}
            aria-disabled={pending}
          >
            <Trash2 size={13} aria-hidden="true" />
            Discard
          </button>
        </div>
      </div>
    </OctaPanel>
  );
}
