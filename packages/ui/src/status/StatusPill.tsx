import type { JSX } from "react";
import type { RunStatus } from "@sandcastle/protocol";
import styles from "./StatusPill.module.css";

const labels: Record<RunStatus, string> = {
  queued: "queued",
  starting: "starting",
  casting: "casting",
  striking: "striking",
  verifying: "verifying",
  "win-pending": "win pending",
  "fail-pending": "fail pending",
  victory: "victory",
  defeat: "defeat",
  aborted: "aborted",
};

export interface StatusPillProps {
  readonly status: RunStatus;
  readonly className?: string;
}

/**
 * Pills the run status with a colour cue + an explicit text label.
 * Color is never the sole signal — the label always reads.
 */
export function StatusPill({
  status,
  className,
}: StatusPillProps): JSX.Element {
  const cls = [styles.root, styles[status], className]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={cls}
      role="status"
      aria-label={`Run status: ${labels[status]}`}
    >
      <i aria-hidden="true" className={styles.glyph} />
      {labels[status]}
    </span>
  );
}
