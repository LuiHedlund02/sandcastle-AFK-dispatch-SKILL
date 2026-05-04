import type { JSX, MouseEvent, ReactNode } from "react";
import type { OperativeMicroState, Run } from "@sandcastle/protocol";
import { StatusPill } from "../status/StatusPill.js";
import styles from "./FleetDock.module.css";

export interface FleetDockCellProps {
  readonly run: Run;
  readonly current?: boolean;
  /** Optional avatar glyph — defaults to π. */
  readonly glyph?: ReactNode;
  /** Optional href for link semantics. If provided, renders an <a>. Otherwise renders a <button>. */
  readonly href?: string;
  /**
   * Live event-driven micro-state for this run. Drives the eye flicker /
   * glow / shake animations. Defaults to "idle".
   */
  readonly microState?: OperativeMicroState;
  readonly onActivate?: (run: Run, event: MouseEvent) => void;
  readonly className?: string;
}

/**
 * Non-color visual token surfaced inside the avatar so the micro-state
 * remains distinguishable for colorblind users and for users with
 * `prefers-reduced-motion: reduce` (where the animation cues are
 * stripped). The glyph inherits `currentColor` from the cell border so
 * it doesn't introduce a new color and remains visible in grayscale.
 */
const MICRO_STATE_GLYPH: Record<OperativeMicroState, string> = {
  idle: "",
  casting: "~",
  striking: "▲",
  crit: "✦",
  hit: "!",
};

/**
 * Phrase appended to the cell's aria-label and broadcast through a
 * visually-hidden polite live region so screen-reader users notice
 * transient micro-state changes that were previously animation-only.
 */
const MICRO_STATE_PHRASE: Record<OperativeMicroState, string> = {
  idle: "",
  casting: "casting",
  striking: "striking",
  crit: "critical strike",
  hit: "taking damage",
};

/**
 * One dock cell. Pure presentational — the parent decides routing.
 * Status colour rides on the avatar AND a label pill so the signal
 * isn't conveyed by colour alone.
 */
export function FleetDockCell({
  run,
  current,
  glyph,
  href,
  microState = "idle",
  onActivate,
  className,
}: FleetDockCellProps): JSX.Element {
  const cls = [
    styles.cell,
    styles[run.status],
    current ? styles.current : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const stateGlyph = MICRO_STATE_GLYPH[microState];
  const statePhrase = MICRO_STATE_PHRASE[microState];

  const inner = (
    <>
      <span className={styles.avatar} aria-hidden="true">
        {glyph ?? "π"}
        <span className={styles.eye} aria-hidden="true" />
        {stateGlyph ? (
          <span className={styles.stateGlyph} aria-hidden="true">
            {stateGlyph}
          </span>
        ) : null}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{run.directive}</span>
        <span className={styles.meta}>
          {run.id} · {run.branch}
        </span>
        <StatusPill status={run.status} />
      </span>
      {/* Polite live region rendered on a separate node so it only
       *  broadcasts the transient micro-state phrase rather than every
       *  re-render of the parent's aria-label. Empty when idle so AT
       *  stays quiet. */}
      <span className={styles.srOnly} aria-live="polite">
        {statePhrase ? `${run.id} ${statePhrase}` : ""}
      </span>
    </>
  );

  const baseLabel = `Run ${run.id} (${run.status}): ${run.directive}`;
  const label = statePhrase ? `${baseLabel} — ${statePhrase}` : baseLabel;

  if (href != null) {
    return (
      <a
        className={cls}
        href={href}
        data-state={microState}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        onClick={(event) => onActivate?.(run, event)}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      data-state={microState}
      aria-label={label}
      aria-current={current ? "true" : undefined}
      onClick={(event) => onActivate?.(run, event)}
    >
      {inner}
    </button>
  );
}
