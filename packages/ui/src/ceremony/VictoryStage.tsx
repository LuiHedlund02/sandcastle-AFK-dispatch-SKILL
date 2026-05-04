import type { CSSProperties, JSX, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChromaticHeadline } from "../fx/ChromaticHeadline.js";
import { OctaPanel } from "../layout/OctaPanel.js";
import { OperativePortrait } from "../operative/OperativePortrait.js";
import { PlanetSvgRenderer } from "../planet/PlanetSvgRenderer.js";
import type { Phase, Planet } from "@sandcastle/protocol";
import { ConfettiSpray } from "./ConfettiSpray.js";
import { XpDeltaBadge } from "./XpDeltaBadge.js";

export interface VictoryStageProps {
  readonly runId: string;
  readonly directive: string;
  /** Optional planet for the thumbnail in the hero. */
  readonly planet?: Planet;
  /** Phases for the merged-summary list. */
  readonly phases?: readonly Phase[];
  /** XP delta from the merge response (or operative XP summary). */
  readonly xpDelta: number | null | undefined;
  /** Operative codename / glyph for the portrait. */
  readonly operativeCodename?: string;
  readonly operativeGlyph?: string;
  /** Merge SHA emitted by control-core (when available). */
  readonly mergeSha?: string | null;
  /** Wall-clock duration in ms (or null). */
  readonly durationMs?: number | null;
  /** "Open cockpit" / "Back to fleet" handlers. Wired by the consumer. */
  readonly onBackToFleet?: () => void;
  readonly onOpenCockpit?: () => void;
  /** Forces reduced-motion behavior even when the OS doesn't request it. */
  readonly reducedMotion?: boolean;
  /** Optional extra slot rendered at the very bottom (e.g. activity feed). */
  readonly footerSlot?: ReactNode;
}

const stageStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: 24,
  minHeight: "100%",
  overflow: "hidden",
};

const heroPanelStyle: CSSProperties = {
  position: "relative",
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

const phasePanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const phaseRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: "8px 12px",
  border: "1px solid rgba(108,255,170,0.25)",
  background: "rgba(108,255,170,0.05)",
};

const phaseMarkerStyle: CSSProperties = {
  fontFamily: "var(--sc-display, sans-serif)",
  fontSize: 14,
  fontWeight: 700,
  color: "var(--sc-plasma, #6cffaa)",
  width: 24,
  textAlign: "center",
};

const phaseTitleStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 12,
  color: "var(--sc-frost, #dceaf3)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const phaseStatusStyle: CSSProperties = {
  fontFamily: "var(--sc-mono, ui-monospace, monospace)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--sc-plasma, #6cffaa)",
};

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

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid var(--sc-plasma, #6cffaa)",
  color: "var(--sc-plasma, #6cffaa)",
  boxShadow: "0 0 12px rgba(108,255,170,0.25)",
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid var(--sc-rule-2, rgba(120,200,220,0.4))",
  color: "var(--sc-frost, #dceaf3)",
};

const confettiHostStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 1,
};

const planetThumbStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 140,
  height: 140,
};

const xpHeroStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

/**
 * Cyberpunk celebration screen for resolved-with-victory runs.
 *
 * Wraps content in `OctaPanel tone="plasma"`. Confetti is rendered as an
 * absolutely-positioned overlay; reduced-motion path renders static dots.
 */
export function VictoryStage({
  runId,
  directive,
  planet,
  phases,
  xpDelta,
  operativeCodename,
  operativeGlyph,
  mergeSha,
  durationMs,
  onBackToFleet,
  onOpenCockpit,
  reducedMotion: forced,
  footerSlot,
}: VictoryStageProps): JSX.Element {
  const reducedMotion = useReducedMotion(forced);
  const phaseList = phases ?? [];
  const verifiedCount = phaseList.filter((p) => p.status === "verified").length;
  const total = phaseList.length;

  return (
    <section style={stageStyle} aria-labelledby={`victory-${runId}`}>
      <OctaPanel
        tone="plasma"
        className=""
        eyebrow={
          <span style={eyebrowStyle}>
            <span style={{ color: "var(--sc-plasma, #6cffaa)" }}>▸</span>
            <span>QUEST CLEARED</span>
            <span style={sepStyle}>·</span>
            <span style={{ color: "var(--sc-cyan, #56d4e0)" }}>{runId}</span>
            <span style={sepStyle}>·</span>
            <span>{formatDuration(durationMs)}</span>
          </span>
        }
      >
        <div style={heroPanelStyle}>
          <div style={confettiHostStyle} aria-hidden="true">
            <ConfettiSpray reducedMotion={reducedMotion} />
          </div>
          <div style={heroBodyStyle}>
            <OperativePortrait
              glyph={operativeGlyph ?? operativeCodename?.charAt(0) ?? "✦"}
              tone="plasma"
              size="lg"
              pulsing={!reducedMotion}
              title={operativeCodename ?? "Operative"}
            />

            <div style={heroTextStyle}>
              <div id={`victory-${runId}`} style={headlineWrap}>
                <ChromaticHeadline as="h1" glitch={!reducedMotion}>
                  VICTORY
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
                  <strong style={{ color: "var(--sc-plasma, #6cffaa)" }}>
                    {verifiedCount}/{total || "—"}
                  </strong>{" "}
                  phases
                </span>
                {mergeSha ? (
                  <>
                    <span style={sepStyle}>/</span>
                    <span title="merge SHA">
                      sha{" "}
                      <code style={{ color: "var(--sc-cyan, #56d4e0)" }}>
                        {mergeSha.slice(0, 7)}
                      </code>
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
        </div>
      </OctaPanel>

      {phaseList.length > 0 ? (
        <OctaPanel
          tone="plasma"
          eyebrow={
            <span style={eyebrowStyle}>
              <span style={{ color: "var(--sc-plasma, #6cffaa)" }}>0x01</span>
              PHASE LOG
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: "var(--sc-rule-2, rgba(120,200,220,0.13))",
                }}
              />
              <span style={{ color: "var(--sc-plasma, #6cffaa)" }}>
                {verifiedCount} / {total}
              </span>
            </span>
          }
        >
          <div style={phasePanelStyle} role="list" aria-label="merged phases">
            {phaseList.map((phase) => (
              <div key={phase.id} style={phaseRowStyle} role="listitem">
                <span style={phaseMarkerStyle}>{romanize(phase.ordinal)}</span>
                <span style={phaseTitleStyle} title={phase.title}>
                  {phase.title}
                </span>
                <span style={phaseStatusStyle}>{phase.status}</span>
              </div>
            ))}
          </div>
        </OctaPanel>
      ) : null}

      <div style={actionsStyle}>
        {onOpenCockpit ? (
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={onOpenCockpit}
          >
            Open cockpit
          </button>
        ) : null}
        {onBackToFleet ? (
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={onBackToFleet}
          >
            Back to fleet
          </button>
        ) : null}
      </div>

      {footerSlot}
    </section>
  );
}

function useReducedMotion(forced?: boolean): boolean {
  const [system, setSystem] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setSystem(mql.matches);
    update();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    // Older Safari fallback
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);
  return Boolean(forced) || system;
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
