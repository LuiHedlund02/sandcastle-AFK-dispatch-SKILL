import type { JSX } from "react";
import styles from "./AttackRoll.module.css";

export interface AttackRollProps {
  /** Tool name, displayed in display caps as the attack label. */
  readonly name: string;
  /** Pre-formatted argument preview (single line). */
  readonly args: string;
  /** True for the in-flight attack — gets the live amber bloom. */
  readonly live?: boolean;
  /** When the tool has finished, whether it succeeded (ok=true) or failed. */
  readonly ok?: boolean;
  /** Tool duration in ms — rendered as `123ms` or `1.2s`. */
  readonly durationMs?: number;
  readonly className?: string;
}

/**
 * One attack-roll line in the combat log. Visually:
 *  - idle (default): cyan glyph + name
 *  - live: amber glyph + bloom; CSS animation gated behind reduced-motion
 *  - ok: plasma glyph; "HIT"
 *  - !ok: crimson glyph; "MISS"
 *
 * Pure presentational. Caller decides which is "live" — typically the most
 * recent `tool.started` without a paired `tool.finished` event.
 */
export function AttackRoll({
  name,
  args,
  live = false,
  ok,
  durationMs,
  className,
}: AttackRollProps): JSX.Element {
  const stateCls = live
    ? styles.live
    : ok === true
      ? styles.ok
      : ok === false
        ? styles.miss
        : "";
  const cls = [styles.root, stateCls, className].filter(Boolean).join(" ");
  const glyph = live ? "‖" : ok === true ? "✓" : ok === false ? "✕" : "▸";
  const stateLabel = live
    ? "in flight"
    : ok === true
      ? "hit"
      : ok === false
        ? "miss"
        : "rolled";

  return (
    <li
      className={cls}
      aria-label={`Attack ${name} — ${stateLabel}`}
      data-state={
        live ? "live" : ok === true ? "ok" : ok === false ? "miss" : "idle"
      }
    >
      <span className={styles.glyph} aria-hidden="true">
        {glyph}
      </span>
      <div className={styles.body}>
        <span className={styles.name}>ATTACK · {name}</span>
        <code className={styles.args}>{args || "no args"}</code>
      </div>
      {typeof durationMs === "number" ? (
        <span
          className={styles.duration}
          aria-label={`Duration ${durationMs}ms`}
        >
          {formatDuration(durationMs)}
        </span>
      ) : null}
    </li>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
