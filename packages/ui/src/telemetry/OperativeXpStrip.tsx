import type { CSSProperties, JSX } from "react";
import type { OperativeXpSummary, XpLedgerEntry } from "@sandcastle/protocol";

/**
 * The summary type returned by `/operatives/:id/xp` carries totalXp + a
 * trimmed array of recent runs (runId / netXp / recordedAt). Some callers
 * (e.g. an XP-detail panel) may pass full ledger entries; we accept either.
 */
export interface OperativeXpStripProps {
  readonly operativeXp: OperativeXpSummary | null | undefined;
  /**
   * Optional richer ledger — when provided, each row can show "(reverted)"
   * if `revertedAt` is set.
   */
  readonly ledger?: readonly XpLedgerEntry[];
  readonly className?: string;
}

const wrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const totalRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const totalLabelStyle: CSSProperties = {
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
};

const totalValueStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "var(--sc-cyan, #56d4e0)",
  textShadow: "0 0 8px rgba(86,212,224,0.35)",
};

const sparkBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 4,
  height: 48,
  padding: "4px 0",
};

const tickContainer = (
  heightPct: number,
  kind: "pos" | "neg" | "zero",
  reverted: boolean,
): CSSProperties => ({
  flex: 1,
  minWidth: 6,
  height: `${Math.max(2, heightPct)}%`,
  background: reverted
    ? "rgba(120,140,160,0.35)"
    : kind === "pos"
      ? "var(--sc-plasma, #6cffaa)"
      : kind === "neg"
        ? "var(--sc-crimson, #ff5e6c)"
        : "var(--sc-steel, #5b6b7a)",
  border: reverted
    ? "1px dashed rgba(120,140,160,0.45)"
    : "1px solid rgba(120,200,220,0.25)",
  opacity: reverted ? 0.55 : 1,
});

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const listItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  gap: 10,
  alignItems: "baseline",
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 11,
  color: "var(--sc-frost, #dceaf3)",
  letterSpacing: "0.04em",
};

const revertedBadgeStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 9,
  padding: "1px 6px",
  border: "1px solid rgba(120,140,160,0.45)",
  color: "var(--sc-steel, #5b6b7a)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const emptyStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 11,
  color: "var(--sc-mist, #9eb3c2)",
  fontStyle: "italic",
};

/**
 * Compact XP strip: shows `totalXp` plus a spark-bar of the operative's last
 * ~N merges. Reverted entries (when ledger supplied) gray out and add a
 * "(reverted)" badge in the row list. When `operativeXp` is null/undefined
 * the strip renders an honest "no signal" placeholder.
 */
export function OperativeXpStrip({
  operativeXp,
  ledger,
  className,
}: OperativeXpStripProps): JSX.Element {
  if (!operativeXp) {
    return (
      <div className={className} style={emptyStyle} aria-label="operative xp">
        — no signal
      </div>
    );
  }

  const recent = operativeXp.recentRuns;
  const ledgerByRun = new Map<string, XpLedgerEntry>();
  for (const entry of ledger ?? []) {
    ledgerByRun.set(entry.runId, entry);
  }

  const max = recent.reduce((acc, r) => Math.max(acc, Math.abs(r.netXp)), 1);

  return (
    <div className={className} style={wrapStyle} aria-label="operative xp">
      <div style={totalRowStyle}>
        <span style={totalLabelStyle}>TOTAL XP</span>
        <span style={totalValueStyle}>
          {operativeXp.totalXp.toLocaleString()}
        </span>
      </div>

      {recent.length === 0 ? (
        <div style={emptyStyle}>— no recent merges yet</div>
      ) : (
        <>
          <div style={sparkBarStyle} aria-hidden="true">
            {recent.map((run) => {
              const entry = ledgerByRun.get(run.runId);
              const reverted = entry?.revertedAt != null;
              const heightPct = (Math.abs(run.netXp) / max) * 100;
              const kind: "pos" | "neg" | "zero" =
                run.netXp > 0 ? "pos" : run.netXp < 0 ? "neg" : "zero";
              return (
                <span
                  key={run.runId}
                  style={tickContainer(heightPct, kind, reverted)}
                  title={`${run.runId} · ${run.netXp >= 0 ? "+" : ""}${run.netXp} XP${reverted ? " (reverted)" : ""}`}
                />
              );
            })}
          </div>

          <ul style={listStyle} aria-label="recent merges">
            {recent.map((run) => {
              const entry = ledgerByRun.get(run.runId);
              const reverted = entry?.revertedAt != null;
              const xpColor =
                run.netXp > 0
                  ? "var(--sc-plasma, #6cffaa)"
                  : run.netXp < 0
                    ? "var(--sc-crimson, #ff5e6c)"
                    : "var(--sc-mist, #9eb3c2)";
              return (
                <li
                  key={run.runId}
                  style={{
                    ...listItemStyle,
                    opacity: reverted ? 0.55 : 1,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: reverted ? "var(--sc-steel, #5b6b7a)" : undefined,
                    }}
                  >
                    {run.runId}
                  </span>
                  <span
                    style={{
                      color: reverted ? "var(--sc-steel, #5b6b7a)" : xpColor,
                    }}
                  >
                    {run.netXp >= 0 ? "+" : ""}
                    {run.netXp} XP
                  </span>
                  {reverted ? (
                    <span style={revertedBadgeStyle}>(reverted)</span>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
