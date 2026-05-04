import type { CSSProperties, JSX, ReactNode } from "react";
import { ChromaticHeadline } from "../fx/ChromaticHeadline.js";
import { OctaPanel } from "../layout/OctaPanel.js";
import { OperativePortrait } from "../operative/OperativePortrait.js";
import { PlanetSvgRenderer } from "../planet/PlanetSvgRenderer.js";
import type { Phase, Planet } from "@sandcastle/protocol";
import { XpDeltaBadge } from "./XpDeltaBadge.js";

export interface DefeatStageProps {
  readonly runId: string;
  readonly directive: string;
  readonly planet?: Planet;
  /** Phases for the failed-checks listing (failed phase highlighted). */
  readonly phases?: readonly Phase[];
  /** XP delta. Usually 0 or negative for defeats; "—" when unknown. */
  readonly xpDelta: number | null | undefined;
  /** Failed-check labels surfaced from `verification.failedChecks`. */
  readonly failedChecks?: readonly string[];
  readonly operativeCodename?: string;
  readonly operativeGlyph?: string;
  /** Count of scars earned on this planet for this operative. */
  readonly scarsEarnedHereCount?: number;
  readonly durationMs?: number | null;
  readonly onRevise?: () => void;
  readonly onDiscard?: () => void;
  readonly onBackToFleet?: () => void;
  /** Forces reduced-motion style (e.g. tests). */
  readonly reducedMotion?: boolean;
  readonly footerSlot?: ReactNode;
}

const stageStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: 24,
  minHeight: "100%",
};

const heroBodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: 28,
  alignItems: "center",
  padding: "16px 4px 8px",
};

const heroTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
};

const eyebrowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
};

const headlineWrap: CSSProperties = {
  fontSize: "clamp(40px, 6vw, 72px)",
  lineHeight: 0.95,
  color: "var(--sc-crimson, #ff5e6c)",
};

const subtitleStyle: CSSProperties = {
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 13,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--sc-mist, #9eb3c2)",
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 14,
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 12,
  color: "var(--sc-frost, #dceaf3)",
};

const sepStyle: CSSProperties = {
  color: "var(--sc-gunmetal, #3a4754)",
};

const checksWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const checkRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  border: "1px solid rgba(255,94,108,0.35)",
  background: "rgba(255,94,108,0.06)",
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 12,
  color: "var(--sc-crimson, #ff5e6c)",
};

const phasePanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const phaseRowStyle = (failed: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: "8px 12px",
  border: failed
    ? "1px solid rgba(255,94,108,0.4)"
    : "1px solid rgba(120,200,220,0.18)",
  background: failed ? "rgba(255,94,108,0.07)" : "rgba(10,16,24,0.55)",
});

const phaseMarkerStyle = (failed: boolean): CSSProperties => ({
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 14,
  fontWeight: 700,
  color: failed ? "var(--sc-crimson, #ff5e6c)" : "var(--sc-mist, #9eb3c2)",
  width: 24,
  textAlign: "center",
});

const phaseTitleStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 12,
  color: "var(--sc-frost, #dceaf3)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const phaseStatusStyle = (failed: boolean): CSSProperties => ({
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: failed ? "var(--sc-crimson, #ff5e6c)" : "var(--sc-mist, #9eb3c2)",
});

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 4,
};

const buttonBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
  background: "transparent",
};

const reviseButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid var(--sc-amber, #ffb547)",
  color: "var(--sc-amber, #ffb547)",
};

const discardButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid var(--sc-crimson, #ff5e6c)",
  color: "var(--sc-crimson, #ff5e6c)",
};

const backButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid var(--sc-rule-2, rgba(120,200,220,0.4))",
  color: "var(--sc-frost, #dceaf3)",
};

const xpHeroStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const planetThumbStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 140,
  height: 140,
};

/**
 * Consolation screen for resolved-with-defeat runs.
 *
 * No confetti. Failed checks surface honestly under "CAUSE OF DEATH".
 * Wraps content in `OctaPanel tone="crimson"`.
 */
export function DefeatStage({
  runId,
  directive,
  planet,
  phases,
  xpDelta,
  failedChecks,
  operativeCodename,
  operativeGlyph,
  scarsEarnedHereCount,
  durationMs,
  onRevise,
  onDiscard,
  onBackToFleet,
  reducedMotion,
  footerSlot,
}: DefeatStageProps): JSX.Element {
  const phaseList = phases ?? [];
  const verifiedCount = phaseList.filter((p) => p.status === "verified").length;
  const failedPhase = phaseList.find((p) => p.status === "failed");
  const total = phaseList.length;
  const checks = failedChecks ?? [];

  return (
    <section style={stageStyle} aria-labelledby={`defeat-${runId}`}>
      <OctaPanel
        tone="crimson"
        eyebrow={
          <span style={eyebrowStyle}>
            <span style={{ color: "var(--sc-crimson, #ff5e6c)" }}>▸</span>
            <span>QUEST FAILED</span>
            <span style={sepStyle}>·</span>
            <span style={{ color: "var(--sc-cyan, #56d4e0)" }}>{runId}</span>
            <span style={sepStyle}>·</span>
            <span>{formatDuration(durationMs)}</span>
            <span style={sepStyle}>·</span>
            <span>
              {verifiedCount} / {total || "—"} phases
            </span>
          </span>
        }
      >
        <div style={heroBodyStyle}>
          <OperativePortrait
            glyph={operativeGlyph ?? operativeCodename?.charAt(0) ?? "✗"}
            tone="crimson"
            size="lg"
            pulsing={false}
            title={operativeCodename ?? "Operative"}
          />

          <div style={heroTextStyle}>
            <div id={`defeat-${runId}`} style={headlineWrap}>
              <ChromaticHeadline as="h1" glitch={!reducedMotion}>
                DEFEAT
              </ChromaticHeadline>
            </div>
            <div style={subtitleStyle} title={directive}>
              {truncate(directive, 110)}
            </div>
            <div style={metaRowStyle}>
              <span style={{ color: "var(--sc-cyan, #56d4e0)" }}>
                {operativeCodename ?? "operative"}
              </span>
              <span style={sepStyle}>/</span>
              <span>
                <strong style={{ color: "var(--sc-crimson, #ff5e6c)" }}>
                  {verifiedCount}/{total || "—"}
                </strong>{" "}
                phases
              </span>
              {failedPhase ? (
                <>
                  <span style={sepStyle}>/</span>
                  <span style={{ color: "var(--sc-crimson, #ff5e6c)" }}>
                    failed at <em>{failedPhase.title}</em>
                  </span>
                </>
              ) : null}
              {scarsEarnedHereCount != null ? (
                <>
                  <span style={sepStyle}>/</span>
                  <span style={{ color: "var(--sc-amber, #ffb547)" }}>
                    {scarsEarnedHereCount} scar
                    {scarsEarnedHereCount === 1 ? "" : "s"} earned here
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div style={xpHeroStyle}>
            {planet ? (
              <div style={planetThumbStyle} aria-hidden="true">
                <PlanetSvgRenderer planet={planet} size={140} />
              </div>
            ) : null}
            <XpDeltaBadge
              xpDelta={xpDelta}
              size="lg"
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </OctaPanel>

      <OctaPanel
        tone="crimson"
        eyebrow={
          <span style={eyebrowStyle}>
            <span style={{ color: "var(--sc-crimson, #ff5e6c)" }}>0x01</span>
            CAUSE OF DEATH
            <span
              style={{
                flex: 1,
                height: 1,
                background: "var(--sc-rule-2, rgba(120,200,220,0.13))",
              }}
            />
            <span style={{ color: "var(--sc-crimson, #ff5e6c)" }}>
              {checks.length || (failedPhase ? 1 : 0)} failed
            </span>
          </span>
        }
      >
        {checks.length === 0 && !failedPhase ? (
          <p
            style={{
              fontFamily: "var(--sc-mono, ui-monospace, monospace)",
              fontSize: 12,
              color: "var(--sc-mist, #9eb3c2)",
            }}
          >
            — no failed checks reported.
          </p>
        ) : (
          <div style={checksWrap} aria-label="failed checks">
            {checks.length === 0 && failedPhase ? (
              <div style={checkRowStyle}>
                <span aria-hidden="true">✗</span>
                <span>{failedPhase.title}</span>
              </div>
            ) : null}
            {checks.map((check) => (
              <div key={check} style={checkRowStyle}>
                <span aria-hidden="true">✗</span>
                <span>{check}</span>
              </div>
            ))}
          </div>
        )}
      </OctaPanel>

      {phaseList.length > 0 ? (
        <OctaPanel
          tone="amber"
          eyebrow={
            <span style={eyebrowStyle}>
              <span style={{ color: "var(--sc-amber, #ffb547)" }}>0x02</span>
              PHASE LOG
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: "var(--sc-rule-2, rgba(120,200,220,0.13))",
                }}
              />
              <span style={{ color: "var(--sc-amber, #ffb547)" }}>
                {verifiedCount} / {total}
              </span>
            </span>
          }
        >
          <div style={phasePanelStyle} role="list" aria-label="phase recap">
            {phaseList.map((phase) => {
              const failed = phase.status === "failed";
              return (
                <div
                  key={phase.id}
                  style={phaseRowStyle(failed)}
                  role="listitem"
                >
                  <span style={phaseMarkerStyle(failed)}>
                    {romanize(phase.ordinal)}
                  </span>
                  <span style={phaseTitleStyle} title={phase.title}>
                    {phase.title}
                  </span>
                  <span style={phaseStatusStyle(failed)}>{phase.status}</span>
                </div>
              );
            })}
          </div>
        </OctaPanel>
      ) : null}

      <div style={actionsStyle}>
        {onRevise ? (
          <button type="button" style={reviseButtonStyle} onClick={onRevise}>
            Revise
          </button>
        ) : null}
        {onDiscard ? (
          <button type="button" style={discardButtonStyle} onClick={onDiscard}>
            Discard
          </button>
        ) : null}
        {onBackToFleet ? (
          <button type="button" style={backButtonStyle} onClick={onBackToFleet}>
            Back to fleet
          </button>
        ) : null}
      </div>

      {footerSlot}
    </section>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

function romanize(n: number): string {
  const m = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  if (n >= 0 && n < m.length) return m[n] ?? `${n}`;
  return `${n}`;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} m ${String(s).padStart(2, "0")} s`;
}
