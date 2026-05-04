import type { CSSProperties, JSX } from "react";
import type { RepoTelemetry } from "@sandcastle/protocol";

export interface TelemetryGridProps {
  /**
   * Telemetry snapshot. Any field may be `null` — the grid renders "—" with
   * a "no signal" tooltip rather than fabricating zero.
   */
  readonly telemetry: RepoTelemetry;
  /** Optional fallback branch label (used when telemetry.branch is null). */
  readonly fallbackBranch?: string;
  readonly className?: string;
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  margin: 0,
  paddingTop: 12,
  borderTop: "1px dashed var(--sc-rule-2, rgba(120,200,220,0.18))",
};

const cellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const keyStyle: CSSProperties = {
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
  fontWeight: 500,
};

const baseValueStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 12,
  letterSpacing: "0.04em",
  fontWeight: 600,
  color: "var(--sc-frost, #dceaf3)",
  margin: 0,
};

const noSignalStyle: CSSProperties = {
  ...baseValueStyle,
  color: "var(--sc-mist, #9eb3c2)",
  fontStyle: "italic",
};

const toneColor = {
  cyan: "var(--sc-cyan, #56d4e0)",
  plasma: "var(--sc-plasma, #6cffaa)",
  amber: "var(--sc-amber, #ffb547)",
  magenta: "var(--sc-magenta, #ff2e88)",
} as const;
type Tone = keyof typeof toneColor;

/**
 * Eight-cell telemetry grid: branch, age, coverage, CI 30d, open issues,
 * tests, churn, last commit. Every cell is `null`-safe — when telemetry is
 * missing we render "—" in muted italic with `title="no signal"`. Never
 * substitutes zero for null.
 */
export function TelemetryGrid({
  telemetry,
  fallbackBranch,
  className,
}: TelemetryGridProps): JSX.Element {
  return (
    <dl style={gridStyle} className={className} aria-label="repo telemetry">
      <Cell
        label="Branch"
        value={telemetry.branch ?? fallbackBranch ?? null}
        formatter={(v) => v}
        tone="cyan"
      />
      <Cell label="Age" value={telemetry.ageDays} formatter={formatAge} />
      <Cell
        label="Coverage"
        value={telemetry.coveragePct}
        formatter={formatPercent}
        tone="plasma"
      />
      <Cell
        label="CI · 30d"
        value={telemetry.ciGreenRate30d}
        formatter={formatPercent}
        tone="plasma"
      />
      <Cell
        label="Open issues"
        value={telemetry.openIssues}
        formatter={(n) => n.toLocaleString()}
        tone="magenta"
      />
      <Cell
        label="Tests"
        value={telemetry.testCount}
        formatter={(n) => n.toLocaleString()}
      />
      <Cell
        label="Churn"
        value={telemetry.churnScore}
        formatter={formatChurn}
        tone="amber"
      />
      <Cell
        label="Last commit"
        value={telemetry.lastCommitAt}
        formatter={formatRelative}
      />
    </dl>
  );
}

interface CellProps<T> {
  readonly label: string;
  readonly value: T | null;
  readonly formatter: (v: NonNullable<T>) => string;
  readonly tone?: Tone;
}

function Cell<T>({ label, value, formatter, tone }: CellProps<T>): JSX.Element {
  const isNull = value == null;
  const formatted = isNull ? "—" : formatter(value as NonNullable<T>);
  const valueStyle: CSSProperties = isNull
    ? noSignalStyle
    : tone
      ? { ...baseValueStyle, color: toneColor[tone] }
      : baseValueStyle;

  return (
    <div style={cellStyle}>
      <dt style={keyStyle}>{label}</dt>
      <dd
        style={valueStyle}
        title={isNull ? "no signal" : undefined}
        data-no-signal={isNull ? "true" : undefined}
      >
        {formatted}
      </dd>
    </div>
  );
}

function formatPercent(value: number): string {
  // RepoTelemetry stores fractions (0..1) when small, raw percents otherwise.
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)} %`;
}

function formatAge(days: number): string {
  if (days < 1) return "today";
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} y`;
}

function formatChurn(score: number): string {
  if (score < 0.33) return "calm";
  if (score < 0.66) return "warm";
  return "hot";
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
