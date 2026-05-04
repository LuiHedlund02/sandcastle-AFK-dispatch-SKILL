import type { CSSProperties, JSX, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, RotateCcw, Globe2 } from "lucide-react";
import type { OperativeIdentity, Planet, Run } from "@sandcastle/protocol";
import {
  ChromaticHeadline,
  GalaxySvgRenderer,
  OperativePortrait,
  type GalaxyTransitOperative,
  type PlanetClimate,
  planetClimate,
} from "@sandcastle/ui";
import { useFleet, useOperatives, useRepos } from "../api/queries";
import { useFleetStore } from "../state/fleetStore";
import { useFleetMicroStateMap } from "../state/useFleetMicroStateMap";

const ALL_CLIMATES: readonly PlanetClimate[] = [
  "clear",
  "warm",
  "storm",
  "live",
  "idle",
];

const climateLabel = (c: PlanetClimate): string => c.toUpperCase();

const climateAccent = (c: PlanetClimate): string => {
  switch (c) {
    case "clear":
      return "var(--sc-cyan)";
    case "warm":
      return "var(--sc-amber)";
    case "storm":
      return "var(--sc-crimson)";
    case "live":
      return "var(--sc-plasma)";
    case "idle":
      return "var(--sc-steel)";
  }
};

const stageWord = (stage: number): string => {
  if (stage >= 5) return "habitable";
  if (stage >= 4) return "life-bearing";
  if (stage >= 3) return "atmosphere";
  if (stage >= 2) return "warm";
  if (stage >= 1) return "seeded";
  return "dormant";
};

const fmtPct = (n: number | null | undefined, digits = 0): string =>
  n == null ? "—" : `${n.toFixed(digits)} %`;

const fmtNumber = (n: number | null | undefined): string =>
  n == null ? "—" : String(n);

const fmtAge = (days: number | null | undefined): string => {
  if (days == null) return "—";
  if (days < 30) return `${Math.round(days)} d`;
  const months = days / 30;
  if (months < 18) return `${months.toFixed(0)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
};

export function GalaxyRoute(): JSX.Element {
  const fleetQuery = useFleet();
  const reposQuery = useRepos();
  const operativesQuery = useOperatives();
  const liveFleet = useFleetStore((state) => state.fleet);
  const fleet = liveFleet ?? fleetQuery.data ?? null;
  const microStateByRunId = useFleetMicroStateMap();

  const planets: Planet[] = useMemo(() => {
    if (!fleet) return [];
    const seen = new Set<string>();
    const out: Planet[] = [];
    const repos = reposQuery.data?.repos ?? [];
    for (const repo of repos) {
      const planet = fleet.planetsById[repo.id];
      if (planet) {
        out.push(planet);
        seen.add(planet.id);
      }
    }
    for (const planet of Object.values(fleet.planetsById)) {
      if (!seen.has(planet.id)) out.push(planet);
    }
    return out;
  }, [fleet, reposQuery.data]);

  const operatives: OperativeIdentity[] =
    operativesQuery.data?.operatives ?? [];

  const runs: Run[] = useMemo(() => {
    if (!fleet) return [];
    return fleet.dockOrder
      .map((id) => fleet.runsById[id])
      .filter((r): r is Run => Boolean(r));
  }, [fleet]);

  const liveRuns = runs.filter(
    (r) =>
      r.status !== "victory" && r.status !== "defeat" && r.status !== "aborted",
  );

  // Climate filter — bitset of which climates to show in the centre.
  const [activeClimates, setActiveClimates] = useState<
    ReadonlySet<PlanetClimate>
  >(new Set(ALL_CLIMATES));

  const planetsWithClimate = useMemo(
    () => planets.map((p) => ({ planet: p, climate: planetClimate(p) })),
    [planets],
  );

  const visiblePlanets = useMemo(
    () =>
      planetsWithClimate
        .filter(({ climate }) => activeClimates.has(climate))
        .map(({ planet }) => planet),
    [planetsWithClimate, activeClimates],
  );

  const climateCounts: Record<PlanetClimate, number> = useMemo(() => {
    const out: Record<PlanetClimate, number> = {
      clear: 0,
      warm: 0,
      storm: 0,
      live: 0,
      idle: 0,
    };
    for (const { climate } of planetsWithClimate) out[climate] += 1;
    return out;
  }, [planetsWithClimate]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Resolve the current planet — explicit selection wins, otherwise the
  // first live planet, otherwise the first planet.
  const selectedPlanet: Planet | null = useMemo(() => {
    if (selectedId) {
      return planets.find((p) => p.id === selectedId) ?? null;
    }
    const live = planets.find((p) => p.activeRunIds.length > 0);
    return live ?? planets[0] ?? null;
  }, [selectedId, planets]);

  const transits: GalaxyTransitOperative[] = useMemo(() => {
    // TODO(galaxy): once a real transit phase exists in the run state,
    // emit one entry per "in-flight" run with the operative codename.
    // For now we model each casting/striking run as a transit toward its
    // planet — gives the centre stage some life immediately.
    const inFlight = liveRuns.filter(
      (r) => r.status === "casting" || r.status === "striking",
    );
    const opByRun = new Map<string, OperativeIdentity | undefined>();
    for (const r of inFlight)
      opByRun.set(
        r.id,
        operatives.find((o) => o.id === r.operativeId),
      );
    return inFlight
      .filter((r) => microStateByRunId[r.id] !== undefined || true)
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        toPlanetId: r.planetId,
        label: opByRun.get(r.id)?.codename,
      }));
  }, [liveRuns, operatives, microStateByRunId]);

  // Build operative roster rows — codename / level / location.
  const rosterRows = useMemo(() => {
    return operatives.map((op) => {
      const opRuns = liveRuns.filter((r) => r.operativeId === op.id);
      const planet = opRuns[0]
        ? planets.find((p) => p.id === opRuns[0]!.planetId)
        : null;
      const inTransit = opRuns.some(
        (r) => r.status === "casting" || r.status === "striking",
      );
      return {
        operative: op,
        planet,
        deployed: opRuns.length > 0,
        inTransit,
      };
    });
  }, [operatives, liveRuns, planets]);

  const fatalError =
    (!liveFleet && fleetQuery.error) ||
    reposQuery.error ||
    operativesQuery.error;

  const initialLoading =
    (fleetQuery.isLoading && !liveFleet) ||
    reposQuery.isLoading ||
    operativesQuery.isLoading;

  if (initialLoading) {
    return (
      <section className="panel cockpit-placeholder" aria-busy="true">
        Charting the galaxy…
      </section>
    );
  }

  if (fatalError && !fleet) {
    return (
      <section className="panel cockpit-placeholder" role="alert">
        Could not reach control-core ·{" "}
        {(fatalError as Error)?.message ?? "unknown error"}
      </section>
    );
  }

  return (
    <section style={shellStyle}>
      {/* ─── L: scope + roster + climate filters ─── */}
      <aside style={leftRailStyle}>
        <RailSection
          title="Your fleet"
          hex="0x01"
          empty={
            rosterRows.length === 0 ? "No operatives recruited yet." : null
          }
        >
          <div style={{ display: "grid", gap: 6 }}>
            {rosterRows.slice(0, 8).map((row) => (
              <RosterRow
                key={row.operative.id}
                op={row.operative}
                planet={row.planet ?? null}
                deployed={row.deployed}
                inTransit={row.inTransit}
              />
            ))}
          </div>
        </RailSection>

        <RailSection title="Climate filters" hex="0x02">
          <div style={{ display: "grid", gap: 4 }}>
            {ALL_CLIMATES.map((c) => {
              const on = activeClimates.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setActiveClimates((prev) => {
                      const next = new Set(prev);
                      if (next.has(c)) next.delete(c);
                      else next.add(c);
                      return next;
                    })
                  }
                  style={filterRowStyle(on, c)}
                  aria-pressed={on}
                >
                  <span
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    <span style={climateGlyphStyle(c)} aria-hidden="true" />
                    {climateLabel(c)}
                  </span>
                  <span style={filterCountStyle(on)}>{climateCounts[c]}</span>
                </button>
              );
            })}
          </div>
        </RailSection>
      </aside>

      {/* ─── center: galaxy stage ─── */}
      <main style={centerStyle}>
        <div style={galaxyHeadStyle}>
          <div style={crumbStyle}>
            <span style={{ color: "var(--sc-cyan)" }}>0x01</span>
            <span>GALAXY</span>
            <span style={{ color: "var(--sc-gunmetal)" }}>/</span>
            <span style={crumbCurStyle}>System Sol-7</span>
            <span style={{ color: "var(--sc-gunmetal)" }}>·</span>
            <span style={{ color: "var(--sc-cyan)" }}>
              {planets.length} planets · {operatives.length} fleet ·{" "}
              {transits.length} in transit
            </span>
          </div>
          <span style={statusBadgeStyle}>
            <span style={statusDotStyle} aria-hidden="true" />
            {liveRuns.length} LIVE · {climateCounts.storm} STORM
          </span>
        </div>

        {planets.length === 0 ? (
          <div style={emptyGalaxyStyle}>
            <ChromaticHeadline as="h2" glitch={false}>
              Galaxy is empty
            </ChromaticHeadline>
            <p style={{ color: "var(--sc-steel)", marginTop: 6 }}>
              Run <code>sandcastle init</code> to register your first planet.
            </p>
          </div>
        ) : (
          <GalaxySvgRenderer
            planets={visiblePlanets}
            currentPlanetId={selectedPlanet?.id}
            onSelectPlanet={(planet) => setSelectedId(planet.id)}
            transits={transits}
          />
        )}
      </main>

      {/* ─── R: selected planet detail ─── */}
      <aside style={rightRailStyle}>
        <SelectedPlanetPanel
          planet={selectedPlanet}
          runs={liveRuns}
          operatives={operatives}
        />
      </aside>
    </section>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────

const shellStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr) 320px",
  minHeight: "100%",
  height: "100%",
  position: "relative",
  background: "var(--sc-hull-0)",
};

const leftRailStyle: CSSProperties = {
  borderRight: "1px solid var(--sc-rule-2)",
  background: "linear-gradient(180deg, var(--sc-hull-1), var(--sc-hull-0))",
  overflowY: "auto",
  padding: 0,
  minWidth: 0,
};

const centerStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(1100px 540px at 50% 50%, rgba(86,212,224,0.10), transparent 65%), radial-gradient(700px 400px at 12% 110%, rgba(255,46,136,0.07), transparent 60%), radial-gradient(700px 400px at 88% -10%, rgba(108,255,170,0.05), transparent 60%), var(--sc-hull-0)",
  minWidth: 0,
};

const rightRailStyle: CSSProperties = {
  borderLeft: "1px solid var(--sc-rule-2)",
  background: "linear-gradient(180deg, var(--sc-hull-1), var(--sc-hull-0))",
  overflowY: "auto",
  minWidth: 0,
};

const galaxyHeadStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  left: 24,
  right: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  zIndex: 5,
  pointerEvents: "none",
};

const crumbStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 11,
  color: "var(--sc-mist)",
  letterSpacing: "0.04em",
  fontFamily: "var(--sc-mono)",
  pointerEvents: "auto",
};

const crumbCurStyle: CSSProperties = {
  color: "var(--sc-frost)",
  fontFamily: "var(--sc-display)",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textShadow: "-0.5px 0 var(--sc-magenta), 0.5px 0 var(--sc-cyan)",
};

const statusBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  fontFamily: "var(--sc-mono)",
  fontSize: 10,
  color: "var(--sc-frost)",
  padding: "5px 12px",
  border: "1px solid var(--sc-cyan)",
  background: "var(--sc-cyan-ink)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  pointerEvents: "auto",
};

const statusDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  transform: "rotate(45deg)",
  background: "var(--sc-cyan)",
  boxShadow: "0 0 8px var(--sc-cyan)",
};

const emptyGalaxyStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  color: "var(--sc-steel)",
};

// ─── left rail bits ──────────────────────────────────────────────────────

function RailSection({
  title,
  hex,
  empty,
  children,
}: {
  readonly title: string;
  readonly hex?: string;
  readonly empty?: string | null;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderTop: "1px solid var(--sc-rule)",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--sc-display)",
          fontSize: 9,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "var(--sc-steel)",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {hex ? (
          <span
            style={{
              fontFamily: "var(--sc-mono)",
              color: "var(--sc-cyan)",
              letterSpacing: "0.05em",
            }}
          >
            {hex}
          </span>
        ) : null}
        {title}
        <span
          style={{
            flex: 1,
            height: 1,
            background: "var(--sc-rule-2)",
          }}
        />
      </h3>
      {empty ? (
        <p
          style={{
            color: "var(--sc-steel)",
            fontFamily: "var(--sc-mono)",
            fontSize: 11,
            margin: 0,
          }}
        >
          {empty}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function RosterRow({
  op,
  planet,
  deployed,
  inTransit,
}: {
  readonly op: OperativeIdentity;
  readonly planet: Planet | null;
  readonly deployed: boolean;
  readonly inTransit: boolean;
}): JSX.Element {
  const tone: "deployed" | "transit" | "idle" = inTransit
    ? "transit"
    : deployed
      ? "deployed"
      : "idle";

  const borderColor =
    tone === "deployed"
      ? "var(--sc-cyan-dim)"
      : tone === "transit"
        ? "var(--sc-amber)"
        : "var(--sc-rule-2)";
  const bg =
    tone === "deployed"
      ? "var(--sc-cyan-ink)"
      : tone === "transit"
        ? "rgba(255,181,71,0.10)"
        : "var(--sc-hull-2)";
  const where =
    tone === "transit"
      ? "▸ in transit"
      : planet
        ? `▸ ${planet.repoName}`
        : "▸ docked · ready";
  const whereColor =
    tone === "deployed"
      ? "var(--sc-cyan)"
      : tone === "transit"
        ? "var(--sc-amber)"
        : "var(--sc-steel)";

  const portraitTone =
    tone === "transit" ? "amber" : tone === "deployed" ? "cyan" : "cyan";

  return (
    <Link
      to={`/operatives/${op.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "30px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "7px 10px",
        border: `1px solid ${borderColor}`,
        background: bg,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <OperativePortrait
        size="sm"
        tone={portraitTone}
        glyph={op.codename.slice(0, 1)}
        title={op.codename}
      />
      <span style={{ minWidth: 0, display: "grid", gap: 1 }}>
        <strong
          style={{
            fontFamily: "var(--sc-display)",
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--sc-frost)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {op.codename}
        </strong>
        <span
          style={{
            fontFamily: "var(--sc-mono)",
            fontSize: 9,
            color: whereColor,
            letterSpacing: "0.03em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {where}
        </span>
      </span>
      <span
        style={{
          fontFamily: "var(--sc-display)",
          fontWeight: 700,
          fontSize: 13,
          color: tone === "idle" ? "var(--sc-steel)" : "var(--sc-magenta)",
          textShadow: tone === "idle" ? "none" : "0 0 4px rgba(255,46,136,0.4)",
        }}
      >
        {String(op.level).padStart(2, "0")}
      </span>
    </Link>
  );
}

const filterRowStyle = (on: boolean, _c: PlanetClimate): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 10px",
  border: `1px solid ${on ? "var(--sc-cyan-dim)" : "var(--sc-rule-2)"}`,
  background: on ? "var(--sc-cyan-ink)" : "var(--sc-hull-1)",
  fontFamily: "var(--sc-mono)",
  fontSize: 10,
  color: on ? "var(--sc-cyan)" : "var(--sc-mist)",
  letterSpacing: "0.05em",
  cursor: "pointer",
  textAlign: "left",
});

const filterCountStyle = (on: boolean): CSSProperties => ({
  fontSize: 9,
  color: on ? "var(--sc-cyan)" : "var(--sc-steel)",
  letterSpacing: "0.05em",
});

const climateGlyphStyle = (c: PlanetClimate): CSSProperties => ({
  width: 8,
  height: 8,
  transform: "rotate(45deg)",
  display: "inline-block",
  marginRight: 6,
  verticalAlign: "middle",
  background: climateAccent(c),
  boxShadow: c === "idle" ? "none" : `0 0 4px ${climateAccent(c)}`,
});

// ─── right rail / selected planet ────────────────────────────────────────

function SelectedPlanetPanel({
  planet,
  runs,
  operatives,
}: {
  readonly planet: Planet | null;
  readonly runs: Run[];
  readonly operatives: OperativeIdentity[];
}): JSX.Element {
  if (!planet) {
    return (
      <div style={{ padding: 22, color: "var(--sc-steel)" }}>
        <span style={{ fontFamily: "var(--sc-mono)", fontSize: 11 }}>
          Select a planet to inspect.
        </span>
      </div>
    );
  }

  const climate = planetClimate(planet);
  const t = planet.telemetry;
  const planetRuns = runs.filter((r) => r.planetId === planet.id);

  return (
    <>
      <div
        style={{
          padding: "18px 22px",
          borderBottom: "1px solid var(--sc-rule)",
        }}
      >
        <div style={selEyebrowStyle}>
          <span style={{ color: "var(--sc-magenta)" }}>SELECTED ▸ PLANET</span>
          <span
            style={{ flex: 1, height: 1, background: "var(--sc-rule-2)" }}
          />
          <span style={{ color: "var(--sc-magenta)" }}>
            stage {planet.terraformStage}
          </span>
        </div>
        <h2 style={selNameStyle}>{planet.repoName}</h2>
        <div style={selStageStyle}>
          ▸ STAGE {planet.terraformStage} ·{" "}
          {stageWord(planet.terraformStage).toUpperCase()} ·{" "}
          <span style={{ color: climateAccent(climate) }}>
            {climate.toUpperCase()}
          </span>
        </div>

        <div style={vitalsGridStyle}>
          <Vital label="Tests · LOC" value={fmtNumber(t.testCount)} tone="" />
          <Vital label="Age" value={fmtAge(t.ageDays)} tone="" />
          <Vital label="Coverage" value={fmtPct(t.coveragePct)} tone="p" />
          <Vital
            label="CI 30d"
            value={
              t.ciGreenRate30d == null
                ? "—"
                : `${Math.round(t.ciGreenRate30d)} %`
            }
            tone="p"
          />
          <Vital label="Hostiles" value={fmtNumber(t.openIssues)} tone="m" />
          <Vital
            label="Churn"
            value={t.churnScore == null ? "—" : t.churnScore.toFixed(2)}
            tone="cy"
          />
        </div>
      </div>

      <SelSection title="Operatives landed" hex="0x02">
        {planetRuns.length === 0 ? (
          <p style={selMutedStyle}>No operative on the surface.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {planetRuns.map((run) => {
              const op = operatives.find((o) => o.id === run.operativeId);
              return (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}/cockpit`}
                  style={depRowStyle}
                >
                  <OperativePortrait
                    size="sm"
                    tone="cyan"
                    glyph={op?.codename.slice(0, 1) ?? "?"}
                  />
                  <span style={{ minWidth: 0, display: "grid", gap: 1 }}>
                    <strong style={depNameStyle}>
                      {op?.codename ?? run.operativeId}
                    </strong>
                    <span style={depMetaStyle}>⌬ {run.directive}</span>
                  </span>
                  <span style={depLvlStyle}>
                    {String(op?.level ?? 0).padStart(2, "0")}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </SelSection>

      <SelSection
        title="Hostiles"
        hex="0x03"
        rightLabel={t.openIssues != null ? `${t.openIssues} ACTIVE` : null}
      >
        {t.openIssues == null ? (
          <p style={selMutedStyle}>No hostile telemetry.</p>
        ) : t.openIssues === 0 ? (
          <p style={selMutedStyle}>No hostiles.</p>
        ) : (
          <p style={selMutedStyle}>
            {t.openIssues} open issue{t.openIssues === 1 ? "" : "s"} on{" "}
            {planet.repoName}. Open the planet view for the full bestiary.
          </p>
        )}
        {planet.scars.length > 0 ? (
          <ul style={scarListStyle}>
            {planet.scars.slice(0, 5).map((scar) => (
              <li key={scar} style={scarItemStyle}>
                <span style={scarGlyphStyle} aria-hidden="true" />
                {scar}
              </li>
            ))}
          </ul>
        ) : null}
      </SelSection>

      <SelSection title="Deck" hex="0x04">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Tag tone="amber">{planet.deck.mode.title}</Tag>
          <Tag tone="cyan">{planet.deck.skills.length} skills</Tag>
          <Tag tone="magenta">{planet.deck.commands.length} commands</Tag>
        </div>
      </SelSection>

      <div
        style={{
          padding: "16px 22px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Link to={`/planet/${planet.id}`} style={btnLandStyle}>
          <Globe2 size={12} />
          Open planet
        </Link>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("sandcastle:open-deploy"))
          }
          style={btnDeployStyle}
        >
          <Play size={12} fill="currentColor" />
          Deploy operative
        </button>
        <Link to="/fleet" style={btnNeutralStyle}>
          <RotateCcw size={12} />
          Fleet overview
        </Link>
      </div>
    </>
  );
}

function SelSection({
  title,
  hex,
  rightLabel,
  children,
}: {
  readonly title: string;
  readonly hex: string;
  readonly rightLabel?: string | null;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      style={{
        padding: "16px 22px",
        borderBottom: "1px solid var(--sc-rule)",
      }}
    >
      <h4 style={selSectionHeadStyle}>
        <span
          style={{
            fontFamily: "var(--sc-mono)",
            color: "var(--sc-cyan)",
            letterSpacing: "0.05em",
          }}
        >
          {hex}
        </span>
        {title}
        <span
          style={{
            flex: 1,
            height: 1,
            background: "var(--sc-rule-2)",
          }}
        />
        {rightLabel ? (
          <span
            style={{
              fontFamily: "var(--sc-mono)",
              fontSize: 9,
              color: "var(--sc-magenta)",
              letterSpacing: "0.05em",
            }}
          >
            {rightLabel}
          </span>
        ) : null}
      </h4>
      {children}
    </section>
  );
}

function Vital({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: "" | "cy" | "p" | "am" | "m";
}): JSX.Element {
  const color =
    tone === "cy"
      ? "var(--sc-cyan)"
      : tone === "p"
        ? "var(--sc-plasma)"
        : tone === "am"
          ? "var(--sc-amber)"
          : tone === "m"
            ? "var(--sc-magenta)"
            : "var(--sc-frost)";
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--sc-display)",
          fontSize: 8.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--sc-steel)",
          fontWeight: 500,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--sc-mono)",
          fontSize: 11.5,
          color,
          letterSpacing: "0.04em",
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Tag({
  tone,
  children,
}: {
  readonly tone: "amber" | "cyan" | "magenta";
  readonly children: ReactNode;
}): JSX.Element {
  const styleMap: Record<string, CSSProperties> = {
    amber: {
      color: "var(--sc-amber)",
      border: "1px solid var(--sc-amber)",
      background: "var(--sc-amber-dim)",
    },
    cyan: {
      color: "var(--sc-cyan)",
      border: "1px solid var(--sc-cyan-dim)",
      background: "var(--sc-cyan-ink)",
    },
    magenta: {
      color: "var(--sc-magenta)",
      border: "1px solid var(--sc-magenta-dim)",
      background: "var(--sc-magenta-ink)",
    },
  };
  return (
    <span
      style={{
        fontFamily: "var(--sc-mono)",
        fontSize: 9.5,
        padding: "3px 8px",
        letterSpacing: "0.05em",
        ...styleMap[tone],
      }}
    >
      {children}
    </span>
  );
}

const selEyebrowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: "var(--sc-display)",
  fontSize: 9,
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--sc-steel)",
  fontWeight: 500,
};

const selNameStyle: CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--sc-display)",
  fontWeight: 600,
  fontSize: 22,
  color: "var(--sc-frost)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  textShadow: "-1px 0 var(--sc-magenta), 1px 0 var(--sc-cyan)",
};

const selStageStyle: CSSProperties = {
  marginTop: 4,
  fontFamily: "var(--sc-mono)",
  fontSize: 10,
  color: "var(--sc-cyan)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const vitalsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px 14px",
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px dashed var(--sc-rule-2)",
};

const selSectionHeadStyle: CSSProperties = {
  fontFamily: "var(--sc-display)",
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--sc-steel)",
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
};

const selMutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--sc-steel)",
  fontFamily: "var(--sc-mono)",
  fontSize: 11,
};

const depRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px 1fr auto",
  gap: 10,
  alignItems: "center",
  padding: "7px 10px",
  border: "1px solid var(--sc-cyan-dim)",
  background: "var(--sc-cyan-ink)",
  textDecoration: "none",
  color: "inherit",
};

const depNameStyle: CSSProperties = {
  fontFamily: "var(--sc-display)",
  fontSize: 10.5,
  fontWeight: 600,
  color: "var(--sc-frost)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const depMetaStyle: CSSProperties = {
  fontFamily: "var(--sc-mono)",
  fontSize: 9,
  color: "var(--sc-cyan)",
  letterSpacing: "0.04em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const depLvlStyle: CSSProperties = {
  fontFamily: "var(--sc-display)",
  fontWeight: 700,
  fontSize: 14,
  color: "var(--sc-magenta)",
  textShadow: "0 0 4px rgba(255,46,136,0.4)",
};

const scarListStyle: CSSProperties = {
  marginTop: 8,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 4,
};

const scarItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "var(--sc-mono)",
  fontSize: 10,
  color: "var(--sc-mist)",
  letterSpacing: "0.03em",
};

const scarGlyphStyle: CSSProperties = {
  width: 8,
  height: 8,
  transform: "rotate(45deg)",
  background: "var(--sc-magenta)",
  boxShadow: "0 0 4px var(--sc-magenta)",
  display: "inline-block",
};

const btnBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 16px",
  fontFamily: "var(--sc-display)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  border: "1px solid var(--sc-rule-2)",
  background: "var(--sc-hull-3)",
  color: "var(--sc-frost)",
  textDecoration: "none",
};

const btnLandStyle: CSSProperties = {
  ...btnBaseStyle,
  background: "linear-gradient(180deg, var(--sc-magenta-2), var(--sc-magenta))",
  color: "var(--sc-void)",
  borderColor: "var(--sc-magenta)",
  fontWeight: 700,
  boxShadow:
    "0 0 20px rgba(255,46,136,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
  letterSpacing: "0.18em",
};

const btnDeployStyle: CSSProperties = {
  ...btnBaseStyle,
  background: "linear-gradient(180deg, var(--sc-cyan-2), var(--sc-cyan))",
  color: "var(--sc-void)",
  borderColor: "var(--sc-cyan)",
  fontWeight: 700,
  boxShadow:
    "0 0 20px rgba(86,212,224,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
  letterSpacing: "0.18em",
  cursor: "pointer",
};

const btnNeutralStyle: CSSProperties = {
  ...btnBaseStyle,
};
