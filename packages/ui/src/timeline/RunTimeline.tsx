import type { JSX, ReactNode } from "react";
import type { RunEvent } from "@sandcastle/protocol";
import { ToolTimelineCard } from "./ToolTimelineCard.js";
import styles from "./RunTimeline.module.css";

export interface RunTimelineProps {
  readonly events: readonly RunEvent[];
  readonly emptyHint?: ReactNode;
  readonly className?: string;
}

/**
 * Convenience wrapper rendering a list of `ToolTimelineCard` rows.
 * Useful for the cockpit screen; screens that need fancier slicing can
 * compose `ToolTimelineCard` directly.
 */
export function RunTimeline({
  events,
  emptyHint,
  className,
}: RunTimelineProps): JSX.Element {
  if (events.length === 0) {
    return (
      <div className={[styles.empty, className].filter(Boolean).join(" ")}>
        <span className={styles.reticle} />
        <p>{emptyHint ?? "Awaiting first stream packet."}</p>
      </div>
    );
  }
  return (
    <ol
      className={[styles.list, className].filter(Boolean).join(" ")}
      aria-label="Run timeline"
    >
      {events.map((event, index) => (
        <ToolTimelineCard event={event} key={`${event.type}-${index}`} />
      ))}
    </ol>
  );
}
