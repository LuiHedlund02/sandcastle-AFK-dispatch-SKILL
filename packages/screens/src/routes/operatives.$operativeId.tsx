import type { CSSProperties, JSX } from "react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChromaticHeadline,
  CrtRasterOverlay,
  FilmGrainOverlay,
  OctaPanel,
  OperativePortrait,
  OperativeXpStrip,
  ReactiveOperativeTile,
  StatusPill,
} from "@sandcastle/ui";
import type {
  OperativeIdentity,
  OperativeMicroState,
  OperativeRepoRecord,
  Run,
} from "@sandcastle/protocol";
import { useFleet, useOperative, useOperativeXp } from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

/* ------------------------------------------------------------------ styles */

const layoutStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)",
  gap: 20,
  padding: 24,
  minHeight: "100%",
};

const stageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  minWidth: 0,
};

const railStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  minWidth: 0,
};

const heroBodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: 28,
  alignItems: "center",
};

const eyebrowRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const dotStyle: CSSProperties = {
  color: "var(--sc-magenta, #ff2e88)",
};

const idStyle: CSSProperties = {
  color: "var(--sc-cyan, #56d4e0)",
  letterSpacing: "0.18em",
};

const codenameStyle: CSSProperties = {
  fontSize: "clamp(40px, 6vw, 76px)",
  lineHeight: 0.95,
  margin: "10px 0 8px",
  textTransform: "uppercase",
  fontWeight: 800,
  letterSpacing: "0.02em",
};

const classLineStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
  fontSize: 13,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--sc-mist, #9eb3c2)",
};

const chassisChipStyle: CSSProperties = {
  fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
  fontSize: 11,
  padding: "3px 10px",
  border: "1px solid var(--sc-cyan-dim, rgba(86,212,224,0.3))",
  background: "rgba(86,212,224,0.06)",
  color: "var(--sc-cyan, #56d4e0)",
  letterSpacing: "0.05em",
  textTransform: "none",
};

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 12,
};

const statCellStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(120,200,220,0.13)",
  background: "rgba(10,16,24,0.55)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const statKeyStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
  fontWeight: 500,
};

const statValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "var(--sc-frost, #dceaf3)",
  letterSpacing: "0.04em",
  lineHeight: 1.05,
};

const statValueAccent = (color: string): CSSProperties => ({
  ...statValueStyle,
  color,
  textShadow: `0 0 8px ${color}55`,
});

const xpBarOuterStyle: CSSProperties = {
  marginTop: 8,
  height: 6,
  background: "rgba(36,49,64,0.7)",
  border: "1px solid rgba(120,200,220,0.13)",
  position: "relative",
  overflow: "hidden",
};

const xpBarFillStyle = (pct: number): CSSProperties => ({
  height: "100%",
  width: `${Math.max(0, Math.min(100, pct))}%`,
  background:
    "linear-gradient(90deg, var(--sc-cyan, #56d4e0), var(--sc-magenta, #ff2e88))",
  boxShadow: "0 0 10px rgba(86,212,224,0.5)",
});

const repoFactsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  margin: 0,
};

const factDtStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
  fontWeight: 500,
};

const factDdStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 13,
  color: "var(--sc-frost, #dceaf3)",
  fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
  letterSpacing: "0.03em",
};

const scarListStyle: CSSProperties = {
  marginTop: 4,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const scarChipStyle: CSSProperties = {
  fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
  fontSize: 10,
  padding: "2px 8px",
  border: "1px solid rgba(255,94,108,0.4)",
  background: "rgba(255,94,108,0.08)",
  color: "var(--sc-crimson, #ff5e6c)",
  letterSpacing: "0.05em",
};

const traitChipStyle: CSSProperties = {
  ...scarChipStyle,
  borderColor: "rgba(255,46,136,0.4)",
  background: "rgba(255,46,136,0.08)",
  color: "var(--sc-magenta, #ff2e88)",
};

const placeholderStyle: CSSProperties = {
  padding: 24,
  margin: 24,
};

const emptyStateStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--sc-mist, #9eb3c2)",
  fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
  letterSpacing: "0.04em",
  lineHeight: 1.6,
};

const deployRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "center",
  padding: "8px 10px",
  border: "1px solid rgba(120,200,220,0.13)",
  background: "rgba(10,16,24,0.55)",
};

const deployRowLinkStyle: CSSProperties = {
  ...deployRowStyle,
  color: "inherit",
  textDecoration: "none",
};

const deployBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const deployTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--sc-frost, #dceaf3)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const deployMetaStyle: CSSProperties = {
  fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
  fontSize: 10,
  color: "var(--sc-steel, #5b6b7a)",
  letterSpacing: "0.04em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sectionLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 9,
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--sc-steel, #5b6b7a)",
  fontWeight: 600,
};

/* ------------------------------------------------------------------ helpers */

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function microStateForRun(status: Run["status"]): OperativeMicroState {
  switch (status) {
    case "casting":
    case "queued":
    case "starting":
    case "verifying":
      return "casting";
    case "striking":
      return "striking";
    case "win-pending":
      return "crit";
    case "fail-pending":
    case "defeat":
    case "aborted":
      return "hit";
    case "victory":
      return "crit";
    default:
      return "idle";
  }
}

/* ------------------------------------------------------------------ route */

export function OperativeRoute(): JSX.Element {
  const { operativeId } = useParams<{ operativeId: string }>();

  if (!operativeId) {
    return (
      <section style={placeholderStyle}>
        <OctaPanel
          tone="amber"
          eyebrow="operative"
          header={<ChromaticHeadline as="h1">No operative</ChromaticHeadline>}
        >
          <p style={emptyStateStyle}>
            No operative id was supplied in the URL. Pick one from the roster.
          </p>
        </OctaPanel>
      </section>
    );
  }

  return <OperativeContent operativeId={operativeId} />;
}

function OperativeContent({
  operativeId,
}: {
  readonly operativeId: string;
}): JSX.Element {
  const { data, isLoading, error } = useOperative(operativeId);
  const { data: fleet } = useFleet();
  const operativeXpQuery = useOperativeXp(operativeId);
  const liveFleet = useFleetStore((state) => state.fleet);
  const activeFleet = liveFleet ?? fleet;

  const operative: OperativeIdentity | undefined = data;
  const repoRecord: OperativeRepoRecord | undefined = data?.repoRecord;

  const activeDeployments = useMemo<readonly Run[]>(() => {
    if (!activeFleet) return [];
    return activeFleet.dockOrder
      .map((id) => activeFleet.runsById[id])
      .filter((r): r is Run => Boolean(r))
      .filter((r) => r.operativeId === operativeId);
  }, [activeFleet, operativeId]);
  const primaryDeployment: Run | undefined = activeDeployments[0];

  if (isLoading && !operative) {
    return (
      <section style={placeholderStyle}>
        <OctaPanel
          eyebrow="operative"
          header={
            <ChromaticHeadline as="h1">
              Loading operative {operativeId}…
            </ChromaticHeadline>
          }
        >
          <p style={emptyStateStyle}>Awaiting dossier from control-core.</p>
        </OctaPanel>
      </section>
    );
  }

  if (error && !operative) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section style={placeholderStyle}>
        <OctaPanel
          tone="crimson"
          eyebrow="operative · error"
          header={
            <ChromaticHeadline as="h1">Dossier unavailable</ChromaticHeadline>
          }
        >
          <p style={emptyStateStyle}>
            Could not load operative <code>{operativeId}</code>: {message}
          </p>
          <p style={{ ...emptyStateStyle, marginTop: 8 }}>
            <Link to="/roster" style={{ color: "var(--sc-cyan, #56d4e0)" }}>
              ← back to roster
            </Link>
          </p>
        </OctaPanel>
      </section>
    );
  }

  if (!operative) {
    return (
      <section style={placeholderStyle}>
        <OctaPanel
          tone="amber"
          eyebrow="operative · 404"
          header={
            <ChromaticHeadline as="h1">No such operative</ChromaticHeadline>
          }
        >
          <p style={emptyStateStyle}>
            No operative with id <code>{operativeId}</code> is registered.
          </p>
          <p style={{ ...emptyStateStyle, marginTop: 8 }}>
            <Link to="/roster" style={{ color: "var(--sc-cyan, #56d4e0)" }}>
              ← back to roster
            </Link>
          </p>
        </OctaPanel>
      </section>
    );
  }

  const glyph = operative.codename.charAt(0).toUpperCase() || "π";
  const xpForLevel = Math.max(1, (operative.level + 1) * 1000);
  const xpPct = ((operative.globalXp % xpForLevel) / xpForLevel) * 100;
  const bondPct = Math.max(0, Math.min(100, operative.bond));

  return (
    <section style={layoutStyle}>
      <CrtRasterOverlay />
      <FilmGrainOverlay />

      {/* ---------- main stage ---------- */}
      <div style={stageStyle}>
        {/* hero */}
        <OctaPanel
          tone="magenta"
          size="md"
          eyebrow={
            <span style={eyebrowRowStyle}>
              <span style={dotStyle}>◆</span>
              <span>OPERATIVE</span>
              <span style={dotStyle}>·</span>
              <span style={idStyle}>ID #{operative.id}</span>
            </span>
          }
        >
          <div style={heroBodyStyle}>
            <OperativePortrait
              glyph={glyph}
              tone="magenta"
              size="lg"
              pulsing={activeDeployments.length > 0}
              title={`${operative.codename} · level ${operative.level}`}
            />
            <div style={{ minWidth: 0 }}>
              <ChromaticHeadline as="h1" glitch>
                <span style={codenameStyle}>{operative.codename}</span>
              </ChromaticHeadline>
              <div style={classLineStyle}>
                <span>⌬ {operative.className}</span>
                <span style={{ color: "var(--sc-gunmetal, #3a4754)" }}>|</span>
                <span style={{ color: "var(--sc-magenta, #ff2e88)" }}>
                  {operative.species}
                </span>
                <span style={{ color: "var(--sc-gunmetal, #3a4754)" }}>|</span>
                <span style={chassisChipStyle}>
                  {operative.provider} · {operative.model}
                </span>
              </div>
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "var(--sc-steel, #5b6b7a)",
                    fontWeight: 500,
                  }}
                >
                  <span>Global XP</span>
                  <span
                    style={{
                      fontFamily:
                        "var(--sc-font-mono, ui-monospace, monospace)",
                      fontSize: 11,
                      color: "var(--sc-cyan, #56d4e0)",
                      letterSpacing: "0.05em",
                      textTransform: "none",
                    }}
                  >
                    {operative.globalXp.toLocaleString()} · LV{" "}
                    {String(operative.level).padStart(2, "0")}
                  </span>
                </div>
                <div style={xpBarOuterStyle}>
                  <div style={xpBarFillStyle(xpPct)} />
                </div>
              </div>
            </div>
          </div>
        </OctaPanel>

        {/* core stats */}
        <OctaPanel
          tone="cyan"
          eyebrow={
            <span style={sectionLabel}>
              <span style={{ color: "var(--sc-cyan, #56d4e0)" }}>0x01</span>
              CORE STATS
            </span>
          }
        >
          <div style={statsGridStyle}>
            <div style={statCellStyle}>
              <span style={statKeyStyle}>Level</span>
              <span style={statValueAccent("var(--sc-magenta, #ff2e88)")}>
                {String(operative.level).padStart(2, "0")}
              </span>
            </div>
            <div style={statCellStyle}>
              <span style={statKeyStyle}>Global XP</span>
              <span style={statValueAccent("var(--sc-cyan, #56d4e0)")}>
                {operative.globalXp.toLocaleString()}
              </span>
            </div>
            <div style={statCellStyle}>
              <span style={statKeyStyle}>Bond</span>
              <span style={statValueAccent("var(--sc-magenta, #ff2e88)")}>
                {operative.bond}
              </span>
              <div style={xpBarOuterStyle}>
                <div
                  style={{
                    ...xpBarFillStyle(bondPct),
                    background:
                      "linear-gradient(90deg, var(--sc-magenta, #ff2e88), #ff8d97)",
                  }}
                />
              </div>
            </div>
            <div style={statCellStyle}>
              <span style={statKeyStyle}>Streak</span>
              <span style={statValueAccent("var(--sc-plasma, #6cffaa)")}>
                {operative.streak}
              </span>
            </div>
            <div style={statCellStyle}>
              <span style={statKeyStyle}>Concurrency cap</span>
              <span style={statValueAccent("var(--sc-amber, #ffb547)")}>
                {operative.concurrencyCap}
              </span>
            </div>
            <div style={statCellStyle}>
              <span style={statKeyStyle}>Sleeve cards</span>
              <span style={statValueStyle}>
                {operative.sleeveCardIds.length}
              </span>
            </div>
          </div>
          {operative.unlockedTraits.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <span style={statKeyStyle}>Unlocked traits</span>
              <div style={scarListStyle}>
                {operative.unlockedTraits.map((trait) => (
                  <span key={trait} style={traitChipStyle}>
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </OctaPanel>

        {/* per-repo record */}
        <OctaPanel
          tone={repoRecord ? "plasma" : "amber"}
          eyebrow={
            <span style={sectionLabel}>
              <span
                style={{
                  color: repoRecord
                    ? "var(--sc-plasma, #6cffaa)"
                    : "var(--sc-amber, #ffb547)",
                }}
              >
                0x02
              </span>
              THIS PLANET · DOSSIER
            </span>
          }
          header={
            repoRecord ? (
              <span
                style={{
                  fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
                  fontSize: 10,
                  color: "var(--sc-steel, #5b6b7a)",
                  letterSpacing: "0.05em",
                }}
              >
                planet · {repoRecord.planetId}
              </span>
            ) : null
          }
        >
          {repoRecord ? (
            <>
              <dl style={repoFactsStyle}>
                <div>
                  <dt style={factDtStyle}>Victories</dt>
                  <dd
                    style={{
                      ...factDdStyle,
                      color: "var(--sc-plasma, #6cffaa)",
                    }}
                  >
                    {repoRecord.victoriesCount}
                  </dd>
                </div>
                <div>
                  <dt style={factDtStyle}>Defeats</dt>
                  <dd
                    style={{
                      ...factDdStyle,
                      color: "var(--sc-crimson, #ff5e6c)",
                    }}
                  >
                    {repoRecord.defeatsCount}
                  </dd>
                </div>
                <div>
                  <dt style={factDtStyle}>Planet bond</dt>
                  <dd
                    style={{
                      ...factDdStyle,
                      color: "var(--sc-magenta, #ff2e88)",
                    }}
                  >
                    {repoRecord.planetSpecificBond}
                  </dd>
                </div>
                <div>
                  <dt style={factDtStyle}>Runs landed</dt>
                  <dd style={factDdStyle}>{repoRecord.runIds.length}</dd>
                </div>
                <div>
                  <dt style={factDtStyle}>First landed</dt>
                  <dd style={factDdStyle}>
                    {formatTimestamp(repoRecord.firstLandedAt)}
                  </dd>
                </div>
                <div>
                  <dt style={factDtStyle}>Last landed</dt>
                  <dd style={factDdStyle}>
                    {formatTimestamp(repoRecord.lastLandedAt)}
                  </dd>
                </div>
              </dl>
              {repoRecord.scarsEarnedHere.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <span style={statKeyStyle}>Scars earned here</span>
                  <div style={scarListStyle}>
                    {repoRecord.scarsEarnedHere.map((scar) => (
                      <span key={scar} style={scarChipStyle}>
                        {scar}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p style={emptyStateStyle}>
              <strong style={{ color: "var(--sc-amber, #ffb547)" }}>
                Never landed here.
              </strong>{" "}
              {operative.codename} has no record on this planet yet. Deploy them
              through the chord (⌘D) to begin a dossier.
            </p>
          )}
        </OctaPanel>
      </div>

      {/* ---------- right rail ---------- */}
      <div style={railStyle}>
        <OctaPanel
          tone="cyan"
          eyebrow={
            <span style={sectionLabel}>
              <span style={{ color: "var(--sc-cyan, #56d4e0)" }}>0x03</span>
              CURRENT DEPLOYMENTS
              <span
                style={{ marginLeft: "auto", color: "var(--sc-cyan, #56d4e0)" }}
              >
                {activeDeployments.length}
              </span>
            </span>
          }
        >
          {activeDeployments.length === 0 ? (
            <p style={emptyStateStyle}>
              {operative.codename} is unassigned. Deploy via the chord (⌘D) to
              send them on a run.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {activeDeployments.map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}/cockpit`}
                  style={deployRowLinkStyle}
                >
                  <OperativePortrait
                    glyph={glyph}
                    tone="magenta"
                    size="sm"
                    pulsing={false}
                    title={`run ${run.id}`}
                  />
                  <div style={deployBodyStyle}>
                    <span style={deployTitleStyle}>{run.directive}</span>
                    <span style={deployMetaStyle}>
                      {run.id} · {run.branch}
                    </span>
                  </div>
                  <StatusPill status={run.status} />
                </Link>
              ))}
            </div>
          )}
        </OctaPanel>

        <OctaPanel
          tone="magenta"
          eyebrow={
            <span style={sectionLabel}>
              <span style={{ color: "var(--sc-magenta, #ff2e88)" }}>0x04</span>
              CHASSIS
            </span>
          }
        >
          <dl style={{ ...repoFactsStyle, gridTemplateColumns: "1fr" }}>
            <div>
              <dt style={factDtStyle}>Provider</dt>
              <dd style={factDdStyle}>{operative.provider}</dd>
            </div>
            <div>
              <dt style={factDtStyle}>Model</dt>
              <dd style={factDdStyle}>{operative.model}</dd>
            </div>
            <div>
              <dt style={factDtStyle}>Species</dt>
              <dd style={factDdStyle}>{operative.species}</dd>
            </div>
            <div>
              <dt style={factDtStyle}>Class</dt>
              <dd style={factDdStyle}>{operative.className}</dd>
            </div>
          </dl>
          <p
            style={{
              ...emptyStateStyle,
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px dashed rgba(120,200,220,0.13)",
            }}
          >
            Stats and bond persist across re-chassis;{" "}
            <em style={{ color: "var(--sc-amber, #ffb547)" }}>
              level resets to 1
            </em>{" "}
            when the alloy is changed.
          </p>
        </OctaPanel>

        <OctaPanel
          tone="cyan"
          eyebrow={
            <span style={sectionLabel}>
              <span style={{ color: "var(--sc-cyan, #56d4e0)" }}>0x05</span>
              XP LEDGER
            </span>
          }
        >
          {operativeXpQuery.error instanceof Error ? (
            <p style={emptyStateStyle}>
              xp ledger unavailable: {operativeXpQuery.error.message}
            </p>
          ) : operativeXpQuery.isLoading && !operativeXpQuery.data ? (
            <p style={emptyStateStyle}>Loading xp…</p>
          ) : (
            <OperativeXpStrip operativeXp={operativeXpQuery.data ?? null} />
          )}
        </OctaPanel>

        {primaryDeployment ? (
          <OctaPanel
            tone="plasma"
            eyebrow={
              <span style={sectionLabel}>
                <span style={{ color: "var(--sc-plasma, #6cffaa)" }}>0x06</span>
                PRIMARY RUN
              </span>
            }
          >
            <ReactiveOperativeTile
              operative={operative}
              microState={microStateForRun(primaryDeployment.status)}
              footer={
                <span
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    fontFamily: "var(--sc-font-mono, ui-monospace, monospace)",
                    color: "var(--sc-mist, #9eb3c2)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {primaryDeployment.directive}
                </span>
              }
            />
          </OctaPanel>
        ) : null}
      </div>
    </section>
  );
}
