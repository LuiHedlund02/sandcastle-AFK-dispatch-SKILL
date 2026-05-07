import type { JSX } from "react";
import type { Phase, RunEvent, VerifyRuleResult } from "@sandcastle/protocol";
import { AttackRoll } from "./AttackRoll.js";
import { SavingThrow } from "./SavingThrow.js";
import styles from "./PhaseRound.module.css";

export type PhaseRoundStatus = Phase["status"];

export interface PhaseRoundProps {
  /** The phase being framed as a round. */
  readonly phase: Phase;
  /** Optional: precomputed `tool.started` / `tool.finished` events for THIS phase. */
  readonly toolEvents?: readonly RunEvent[];
  /** Optional: verify-rule results captured during phase.verified / phase.failed. */
  readonly verifyResults?: readonly VerifyRuleResult[];
  readonly className?: string;
}

const STATUS_LABEL: Record<PhaseRoundStatus, string> = {
  pending: "Idle",
  active: "Engaged",
  verified: "Held",
  failed: "Broken",
  skipped: "Skipped",
};

const STATUS_CLASS: Record<PhaseRoundStatus, string> = {
  pending: styles["status-pending"]!,
  active: styles["status-active"]!,
  verified: styles["status-verified"]!,
  failed: styles["status-failed"]!,
  skipped: styles["status-skipped"]!,
};

/** Map verifying state — phase.status moves from active to verified/failed via
 * a transient phase.verifying event. We surface verifying explicitly when it
 * is in progress (status still active but verifyResults are partial). */
function effectiveStatus(
  phase: Phase,
  verifyResults: readonly VerifyRuleResult[] | undefined,
): PhaseRoundStatus | "verifying" {
  if (phase.status === "active" && verifyResults && verifyResults.length > 0) {
    return "verifying";
  }
  return phase.status;
}

/**
 * One phase as a "round" in the combat skin: header announces the round
 * (ordinal + title + status badge), body lists tool calls as attack rolls,
 * and verify-rule results render as saving throws below.
 *
 * Pure presentational — animations are CSS-only, gated behind
 * `prefers-reduced-motion: no-preference`.
 */
export function PhaseRound({
  phase,
  toolEvents = [],
  verifyResults = [],
  className,
}: PhaseRoundProps): JSX.Element {
  const eff = effectiveStatus(phase, verifyResults);
  const renderedStatus: PhaseRoundStatus = eff === "verifying" ? "active" : eff;
  const statusBadgeLabel =
    eff === "verifying" ? "Verifying" : STATUS_LABEL[renderedStatus];

  const cls = [styles.root, className].filter(Boolean).join(" ");

  // Pair tool.started → tool.finished so AttackRoll can render duration / ok.
  const toolPairs = pairToolEvents(toolEvents);

  return (
    <article
      className={cls}
      data-status={eff}
      aria-label={`Round ${phase.ordinal}: ${phase.title} — ${statusBadgeLabel}`}
    >
      <header className={styles.head}>
        <span className={styles.ord} aria-hidden="true">
          R{phase.ordinal}
        </span>
        <div className={styles["title-row"]}>
          <span className={styles.eyebrow}>Round {phase.ordinal}</span>
          <span className={styles.title}>{phase.title}</span>
        </div>
        <span
          className={`${styles.status} ${STATUS_CLASS[renderedStatus]}`}
          aria-label={`Phase status: ${statusBadgeLabel}`}
        >
          {statusBadgeLabel}
        </span>
      </header>

      <p className={styles.objective}>{phase.objective}</p>

      {toolPairs.length === 0 ? (
        <p className={styles["empty-attacks"]}>
          No attacks rolled yet for this round.
        </p>
      ) : (
        <ol className={styles.attacks} aria-label="Attack rolls">
          {toolPairs.map((pair, i) => (
            <AttackRoll
              key={pair.toolCallId ?? `attack-${i}`}
              name={pair.name}
              args={pair.args}
              ok={pair.ok}
              durationMs={pair.durationMs}
              live={pair.live}
            />
          ))}
        </ol>
      )}

      {verifyResults.length > 0 ? (
        <>
          <h4 className={styles["saving-throws-head"]}>Saving throws</h4>
          <ul className={styles["saving-throws"]} aria-label="Saving throws">
            {verifyResults.map((r, i) => (
              <SavingThrow key={`save-${i}`} result={r} />
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}

interface PairedTool {
  readonly toolCallId?: string;
  readonly name: string;
  readonly args: string;
  readonly ok?: boolean;
  readonly durationMs?: number;
  readonly live: boolean;
}

function pairToolEvents(events: readonly RunEvent[]): readonly PairedTool[] {
  const out: PairedTool[] = [];
  const finishedById = new Map<string, RunEvent>();
  for (const e of events) {
    if (e.type === "tool.finished") {
      finishedById.set(e.toolCallId, e);
    }
  }
  for (const e of events) {
    if (e.type === "tool.started") {
      const fin = finishedById.get(e.toolCallId);
      if (fin && fin.type === "tool.finished") {
        out.push({
          toolCallId: e.toolCallId,
          name: e.name,
          args: e.formattedArgs,
          ok: fin.ok,
          durationMs: fin.durationMs,
          live: false,
        });
      } else {
        out.push({
          toolCallId: e.toolCallId,
          name: e.name,
          args: e.formattedArgs,
          live: true,
        });
      }
    } else if (e.type === "toolCall") {
      out.push({
        name: e.name,
        args: e.formattedArgs,
        live: false,
      });
    }
  }
  return out;
}
