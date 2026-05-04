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

  const inner = (
    <>
      <span className={styles.avatar} aria-hidden="true">
        {glyph ?? "π"}
        <span className={styles.eye} aria-hidden="true" />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{run.directive}</span>
        <span className={styles.meta}>
          {run.id} · {run.branch}
        </span>
        <StatusPill status={run.status} />
      </span>
    </>
  );

  const label = `Run ${run.id} (${run.status}): ${run.directive}`;

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
