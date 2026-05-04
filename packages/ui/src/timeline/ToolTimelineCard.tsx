import type { JSX } from "react";
import {
  CheckCircle2,
  CircleDot,
  FileText,
  Terminal,
  XCircle,
} from "lucide-react";
import type { RunEvent } from "@sandcastle/protocol";
import styles from "./ToolTimelineCard.module.css";

export interface ToolTimelineCardProps {
  readonly event: RunEvent;
  readonly className?: string;
}

/**
 * One row in the cockpit timeline. Renders any `RunEvent` with the right
 * icon, headline, and inline payload (text body, tool args, verification
 * checks, etc.).
 *
 * Pure presentational. No state, no fetching.
 */
export function ToolTimelineCard({
  event,
  className,
}: ToolTimelineCardProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");
  return (
    <li className={cls}>
      <span className={iconCls(event)} aria-hidden="true">
        {iconFor(event)}
      </span>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{titleFor(event)}</span>
          <time dateTime={isoOrNow(event.timestamp)}>
            {formatTime(event.timestamp)}
          </time>
        </div>
        {renderPayload(event)}
      </div>
    </li>
  );
}

function iconCls(event: RunEvent): string {
  switch (event.type) {
    case "tool.finished":
      return event.ok
        ? `${styles.icon} ${styles["icon-ok"]}`
        : `${styles.icon} ${styles["icon-fail"]}`;
    case "verification.finished":
      return event.allGreen
        ? `${styles.icon} ${styles["icon-ok"]}`
        : `${styles.icon} ${styles["icon-fail"]}`;
    case "verification.started":
      return `${styles.icon} ${styles["icon-warn"]}`;
    case "run.resolved":
      return event.result === "victory"
        ? `${styles.icon} ${styles["icon-ok"]}`
        : event.result === "defeat"
          ? `${styles.icon} ${styles["icon-fail"]}`
          : `${styles.icon} ${styles["icon-warn"]}`;
    default:
      return styles.icon!;
  }
}

function iconFor(event: RunEvent): JSX.Element {
  if (event.type === "tool.started" || event.type === "toolCall")
    return <Terminal size={15} />;
  if (event.type === "tool.finished")
    return event.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />;
  if (event.type === "text") return <FileText size={15} />;
  return <CircleDot size={15} />;
}

function titleFor(event: RunEvent): string {
  switch (event.type) {
    case "text":
      return "text";
    case "toolCall":
      return `tool call · ${event.name}`;
    case "tool.started":
      return `tool started · ${event.name}`;
    case "tool.finished":
      return `tool finished · ${event.name}`;
    case "run.statusChanged":
      return `status · ${event.from} to ${event.to}`;
    case "run.resolved":
      return `resolved · ${event.result}`;
    case "run.started":
      return "run started";
    case "verification.started":
      return "verification started";
    case "verification.finished":
      return event.allGreen ? "verification green" : "verification failed";
    case "decision.required":
      return `decision · ${event.kind}`;
    case "intervention.used":
      return `intervention · ${event.action}`;
    case "phase.started":
      return `phase ${event.phase.ordinal} · ${event.phase.title}`;
    case "phase.verifying":
      return `phase verifying · ${event.phaseId}`;
    case "phase.verified":
      return `phase verified · ${event.phaseId}`;
    case "phase.failed":
      return `phase failed · ${event.phaseId}`;
  }
}

function renderPayload(event: RunEvent): JSX.Element | null {
  switch (event.type) {
    case "text":
      return <pre className={styles.text}>{event.message}</pre>;
    case "tool.started":
    case "toolCall":
      return (
        <code className={styles.code}>{event.formattedArgs || "no args"}</code>
      );
    case "tool.finished":
      return event.output ? (
        <pre className={styles.text}>{event.output}</pre>
      ) : null;
    case "run.started":
      return <p className={styles.detail}>{event.directive}</p>;
    case "verification.started":
      return (
        <p className={styles.detail}>
          {event.checks.length ? event.checks.join(", ") : "checks pending"}
        </p>
      );
    case "verification.finished":
      return (
        <p className={styles.detail}>
          {event.failedChecks.length
            ? event.failedChecks.join(", ")
            : "all checks green"}
        </p>
      );
    case "run.resolved":
      return (
        <p className={styles.detail}>
          {event.result} (xp Δ {event.xpDelta})
        </p>
      );
    case "run.statusChanged":
    case "decision.required":
    case "intervention.used":
    case "phase.started":
    case "phase.verifying":
    case "phase.verified":
    case "phase.failed":
      return null;
  }
}

function formatTime(timestamp: Date): string {
  return timestamp.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isoOrNow(timestamp: Date): string {
  try {
    return timestamp.toISOString();
  } catch {
    return new Date().toISOString();
  }
}
