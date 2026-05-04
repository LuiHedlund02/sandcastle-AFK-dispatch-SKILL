import type { CSSProperties, JSX } from "react";
import type { ActivityEvent } from "@sandcastle/protocol";
import { XpDeltaBadge } from "./XpDeltaBadge.js";

export interface ActivityFeedProps {
  readonly events: readonly ActivityEvent[];
  /** Soft cap on how many entries to render (default: render all). */
  readonly limit?: number;
  /** Optional now-anchor for relative timestamps (testing). */
  readonly now?: number;
  readonly className?: string;
  /**
   * Optional empty-state message override. Defaults to "no activity yet".
   * Honest empty state — never fabricates entries.
   */
  readonly emptyLabel?: string;
}

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const itemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr) auto",
  alignItems: "baseline",
  gap: 10,
  padding: "8px 10px",
  border: "1px solid var(--sc-rule-2, rgba(120,200,220,0.13))",
  background: "var(--sc-hull-1, rgba(10,16,24,0.55))",
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 11,
  color: "var(--sc-frost, #dceaf3)",
  letterSpacing: "0.03em",
};

const glyphStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 13,
  textAlign: "center",
};

const bodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const summaryStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
};

const emptyStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 11,
  color: "var(--sc-mist, #9eb3c2)",
  letterSpacing: "0.04em",
  padding: "10px 6px",
};

/**
 * Vertical list of `ActivityEvent`s with type-specific glyphs and relative
 * timestamps. Honest empty state when `events` is empty.
 */
export function ActivityFeed({
  events,
  limit,
  now,
  className,
  emptyLabel = "no activity yet",
}: ActivityFeedProps): JSX.Element {
  const list = limit != null ? events.slice(0, limit) : events;

  if (list.length === 0) {
    return (
      <div
        className={className}
        style={emptyStyle}
        role="status"
        aria-label="activity feed empty"
      >
        — {emptyLabel}
      </div>
    );
  }

  return (
    <ul style={listStyle} className={className} aria-label="activity feed">
      {list.map((event) => (
        <li key={event.id} style={itemStyle} data-event-type={event.type}>
          <span aria-hidden="true" style={glyphStyle}>
            {glyphFor(event.type)}
          </span>
          <span style={bodyStyle}>
            <span style={summaryStyle}>{summarize(event)}</span>
            <span style={metaStyle}>
              {labelFor(event.type)} · {formatRelative(event.at, now)}
            </span>
          </span>
          {event.type === "run.resolved" ? (
            <XpDeltaBadge size="sm" xpDelta={event.payload.xpDelta} />
          ) : (
            <span aria-hidden="true" />
          )}
        </li>
      ))}
    </ul>
  );
}

function glyphFor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "run.started":
      return "▸";
    case "run.status-changed":
      return "↺";
    case "phase.updated":
      return "❍";
    case "tool.called":
      return "⚙";
    case "intervention.used":
      return "✋";
    case "run.resolved":
      return "✦";
  }
}

function labelFor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "run.started":
      return "run started";
    case "run.status-changed":
      return "status";
    case "phase.updated":
      return "phase";
    case "tool.called":
      return "tool";
    case "intervention.used":
      return "intervention";
    case "run.resolved":
      return "resolved";
  }
}

function summarize(event: ActivityEvent): string {
  switch (event.type) {
    case "run.started":
      return event.payload.directive;
    case "run.status-changed":
      return `${event.payload.from} → ${event.payload.to}`;
    case "phase.updated":
      return `${event.payload.phaseId} · ${event.payload.status}`;
    case "tool.called":
      return `${event.payload.name}(${truncate(event.payload.formattedArgs, 56)})`;
    case "intervention.used":
      return event.payload.action;
    case "run.resolved":
      return `${event.payload.result}`;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

function formatRelative(iso: string, nowMs?: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const now = nowMs ?? Date.now();
  const diff = now - then;
  if (diff < 0) return "just now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
