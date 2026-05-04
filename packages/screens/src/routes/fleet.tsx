import type { CSSProperties, JSX } from "react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Boxes,
  GitBranch,
  Leaf,
  Radio,
  Users,
} from "lucide-react";
import type {
  OperativeIdentity,
  Planet,
  RegisteredRepo,
  Run,
} from "@sandcastle/protocol";
import {
  ChromaticHeadline,
  CrtRasterOverlay,
  OctaPanel,
  OperativePortrait,
  PlanetSvgRenderer,
  ReactiveOperativeTile,
  StatusPill,
} from "@sandcastle/ui";
import {
  useFleet,
  useOperatives,
  useRepoTelemetry,
  useRepos,
} from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

const fmtRelative = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
};

const planetTone = (planet: Planet): "live" | "warm" | "clear" | "idle" => {
  if (planet.activeRunIds.length > 0) return "live";
  if (planet.terraformStage >= 3) return "clear";
  if (planet.terraformStage >= 1) return "warm";
  return "idle";
};

const stageWord = (stage: number): string => {
  if (stage >= 5) return "habitable";
  if (stage >= 4) return "life-bearing";
  if (stage >= 3) return "atmosphere";
  if (stage >= 2) return "warm";
  if (stage >= 1) return "seeded";
  return "dormant";
};

const planetSize = (planet: Planet): number => {
  // Bigger = more cards on the deck. Bound to a tasteful range.
  const cards = 1 + planet.deck.skills.length + planet.deck.commands.length;
  return Math.min(120, Math.max(56, 56 + cards * 6));
};

// A fixed grid of "orbit slots" around the central sun. Index N maps to a
// stable position on the galaxy backdrop so planets never jitter between
// renders.
const ORBIT_SLOTS: Array<{ readonly top: string; readonly left: string }> = [
  { top: "30%", left: "62%" },
  { top: "32%", left: "26%" },
  { top: "62%", left: "70%" },
  { top: "20%", left: "80%" },
  { top: "70%", left: "22%" },
  { top: "78%", left: "52%" },
  { top: "12%", left: "44%" },
  { top: "50%", left: "10%" },
  { top: "50%", left: "88%" },
];

export function FleetRoute(): JSX.Element {
  const reposQuery = useRepos();
  const fleetQuery = useFleet();
  const operativesQuery = useOperatives();
  const liveFleet = useFleetStore((state) => state.fleet);
  const connectionState = useFleetStore((state) => state.connectionState);

  const fleet = liveFleet ?? fleetQuery.data ?? null;
  const repos: RegisteredRepo[] = reposQuery.data?.repos ?? [];
  const operatives: OperativeIdentity[] =
    operativesQuery.data?.operatives ?? [];

  const planets: Planet[] = useMemo(() => {
    if (!fleet) return [];
    // Prefer the order of the registered-repos list so the galaxy ordering
    // matches what the user sees in the registry; fall back to whatever
    // planets the fleet snapshot reports.
    const seen = new Set<string>();
    const out: Planet[] = [];
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
  }, [fleet, repos]);

  const runs: Run[] = useMemo(() => {
    if (!fleet) return [];
    return fleet.dockOrder
      .map((id) => fleet.runsById[id])
      .filter((r): r is Run => Boolean(r));
  }, [fleet]);

  const liveRuns = runs.filter(
    (run) =>
      run.status !== "victory" &&
      run.status !== "defeat" &&
      run.status !== "aborted",
  );

  const pendingDecisions = fleet?.pendingDecisions ?? [];

  const isInitialLoading =
    (fleetQuery.isLoading && !liveFleet) ||
    reposQuery.isLoading ||
    operativesQuery.isLoading;

  const fatalError =
    (!liveFleet && fleetQuery.error) ||
    reposQuery.error ||
    operativesQuery.error;

  if (isInitialLoading) {
    return (
      <section className="panel cockpit-placeholder" aria-busy="true">
        Charting the fleet…
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

  if (!fleet) {
    return (
      <section className="panel cockpit-placeholder">
        Waiting for the first fleet snapshot…
      </section>
    );
  }

  const capacity = fleet.capacity;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        gap: 18,
        minHeight: "100%",
        position: "relative",
      }}
    >
      {/* ─── galaxy stage ─── */}
      <OctaPanel
        eyebrow={
          <>
            <span style={{ color: "var(--sc-cyan)" }}>0x01</span>
            <span style={{ color: "var(--sc-mist)" }}>FLEET / GALAXY</span>
            <span style={{ color: "var(--sc-gunmetal)" }}>·</span>
            <span style={{ color: "var(--sc-cyan)" }}>
              {liveRuns.length} LIVE · {planets.length} PLANETS
            </span>
            {pendingDecisions.length > 0 ? (
              <>
                <span style={{ color: "var(--sc-gunmetal)" }}>·</span>
                <span style={{ color: "var(--sc-magenta)" }}>
                  {pendingDecisions.length} PENDING
                </span>
              </>
            ) : null}
          </>
        }
        header={
          <>
            <ChromaticHeadline as="h1" glitch={liveRuns.length > 0}>
              Fleet · Sol-7
            </ChromaticHeadline>
            <FleetStatusBadge
              capacity={capacity}
              connectionState={connectionState}
            />
          </>
        }
        bodyClassName="fleet-galaxy-body"
        className="fleet-galaxy-panel"
      >
        <FleetGalaxy planets={planets} runs={runs} />
      </OctaPanel>

      {/* ─── right rail ─── */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridAutoRows: "min-content",
          minWidth: 0,
        }}
      >
        <CapacityPanel
          capacity={capacity}
          liveCount={liveRuns.length}
          planetCount={planets.length}
          operativeCount={operatives.length}
        />

        <ActiveRunsPanel runs={liveRuns} planetsById={fleet.planetsById} />

        <OperativesPanel operatives={operatives} runs={liveRuns} />

        <CurrentPlanetTelemetryPanel
          planet={planets[0] ?? null}
          repo={repos[0] ?? null}
        />
      </div>

      <CrtRasterOverlay />
    </section>
  );
}

// ─── galaxy ────────────────────────────────────────────────────────────────

function FleetGalaxy({
  planets,
  runs,
}: {
  readonly planets: Planet[];
  readonly runs: Run[];
}): JSX.Element {
  if (planets.length === 0) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 360,
          color: "var(--sc-steel)",
          fontFamily: "var(--sc-mono)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <span>No planets registered · run sandcastle init</span>
      </div>
    );
  }

  const liveRunsByPlanet = new Map<string, Run[]>();
  for (const run of runs) {
    const list = liveRunsByPlanet.get(run.planetId) ?? [];
    list.push(run);
    liveRunsByPlanet.set(run.planetId, list);
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: 480,
        height: "100%",
        overflow: "hidden",
        background:
          "radial-gradient(1100px 540px at 50% 50%, rgba(86,212,224,0.10), transparent 65%), radial-gradient(700px 400px at 12% 110%, rgba(255,46,136,0.07), transparent 60%), radial-gradient(700px 400px at 88% -10%, rgba(108,255,170,0.05), transparent 60%), var(--sc-hull-0)",
      }}
    >
      <Starfield />
      <OrbitRings />
      <Sun />
      {planets.map((planet, i) => {
        const slot = ORBIT_SLOTS[i % ORBIT_SLOTS.length]!;
        const tone = planetTone(planet);
        const size = planetSize(planet);
        const liveOnPlanet = liveRunsByPlanet.get(planet.id) ?? [];
        const isLive = liveOnPlanet.length > 0;
        return (
          <Link
            key={planet.id}
            to={`/planet/${planet.id}`}
            aria-label={`Planet ${planet.repoName}, terraform stage ${planet.terraformStage}, ${stageWord(planet.terraformStage)}`}
            style={
              {
                position: "absolute",
                top: slot.top,
                left: slot.left,
                transform: "translate(-50%, -50%)",
                display: "grid",
                placeItems: "center",
                color: "var(--sc-frost)",
                outline: "none",
              } satisfies CSSProperties
            }
            className="fleet-planet-link"
          >
            {isLive ? <DeployBeam /> : null}
            <div
              style={{
                position: "relative",
                width: size,
                height: size,
                filter:
                  tone === "idle" ? "saturate(0.5) brightness(0.8)" : undefined,
              }}
            >
              <PlanetSvgRenderer planet={planet} size={size} />
              {isLive ? <OpsGlyph runs={liveOnPlanet} /> : null}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--sc-display)",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--sc-frost)",
                textShadow:
                  "-0.5px 0 var(--sc-magenta), 0.5px 0 var(--sc-cyan)",
                whiteSpace: "nowrap",
              }}
            >
              {planet.repoName}
              {isLive ? (
                <span
                  style={{
                    marginLeft: 6,
                    fontFamily: "var(--sc-mono)",
                    fontSize: 9,
                    color: "var(--sc-plasma)",
                    letterSpacing: "0.18em",
                    textShadow: "0 0 6px rgba(108,255,170,0.5)",
                  }}
                >
                  · LIVE
                </span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "var(--sc-mono)",
                fontSize: 9,
                color: "var(--sc-steel)",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              stage {romanize(planet.terraformStage)} ·{" "}
              <b
                style={{
                  fontWeight: 500,
                  color:
                    tone === "live"
                      ? "var(--sc-plasma)"
                      : tone === "clear"
                        ? "var(--sc-cyan)"
                        : tone === "warm"
                          ? "var(--sc-amber)"
                          : "var(--sc-steel)",
                }}
              >
                {stageWord(planet.terraformStage)}
              </b>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Starfield(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: [
          "radial-gradient(circle 1px at 14% 18%, rgba(220,234,243,0.6), transparent 1px)",
          "radial-gradient(circle 1px at 32% 8%, rgba(220,234,243,0.5), transparent 1px)",
          "radial-gradient(circle 1px at 58% 22%, rgba(86,212,224,0.6), transparent 1px)",
          "radial-gradient(circle 1px at 76% 12%, rgba(220,234,243,0.5), transparent 1px)",
          "radial-gradient(circle 1px at 88% 28%, rgba(255,46,136,0.5), transparent 1px)",
          "radial-gradient(circle 1px at 12% 36%, rgba(220,234,243,0.4), transparent 1px)",
          "radial-gradient(circle 1px at 26% 52%, rgba(220,234,243,0.5), transparent 1px)",
          "radial-gradient(circle 1px at 48% 60%, rgba(108,255,170,0.5), transparent 1px)",
          "radial-gradient(circle 1px at 64% 70%, rgba(220,234,243,0.5), transparent 1px)",
          "radial-gradient(circle 1px at 80% 80%, rgba(86,212,224,0.5), transparent 1px)",
          "radial-gradient(circle 2px at 70% 40%, rgba(220,234,243,0.7), transparent 2px)",
        ].join(","),
        backgroundRepeat: "no-repeat",
        pointerEvents: "none",
      }}
    />
  );
}

function OrbitRings(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 1100,
        height: 1100,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        border: "1px solid var(--sc-rule)",
        boxShadow: [
          "0 0 0 80px transparent",
          "0 0 0 81px var(--sc-rule)",
          "0 0 0 240px transparent",
          "0 0 0 241px var(--sc-rule)",
          "0 0 0 360px transparent",
          "0 0 0 361px var(--sc-rule)",
        ].join(","),
        pointerEvents: "none",
        opacity: 0.5,
      }}
    />
  );
}

function Sun(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 60,
        height: 60,
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        background:
          "radial-gradient(circle, #fff7d4 0%, #ffb547 40%, #a85a18 80%, transparent 100%)",
        boxShadow:
          "0 0 60px rgba(255,181,71,0.7), 0 0 140px rgba(255,181,71,0.35)",
        zIndex: 2,
      }}
    />
  );
}

function DeployBeam(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: -28,
        borderRadius: "50%",
        border: "1px solid var(--sc-cyan-dim)",
        boxShadow:
          "0 0 28px rgba(86,212,224,0.18), inset 0 0 22px rgba(86,212,224,0.12)",
        pointerEvents: "none",
      }}
    />
  );
}

function OpsGlyph({ runs }: { readonly runs: Run[] }): JSX.Element {
  // Color the marker by the most-active run status.
  const dominant = runs[0]?.status;
  const color =
    dominant === "win-pending" || dominant === "victory"
      ? "var(--sc-plasma)"
      : dominant === "fail-pending" || dominant === "defeat"
        ? "var(--sc-crimson)"
        : "var(--sc-cyan)";
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "30%",
        left: "62%",
        width: 8,
        height: 8,
        background: color,
        boxShadow: `0 0 12px ${color}, 0 0 24px ${color}`,
        transform: "rotate(45deg)",
        zIndex: 5,
      }}
    />
  );
}

// ─── right rail panels ─────────────────────────────────────────────────────

function FleetStatusBadge({
  capacity,
  connectionState,
}: {
  readonly capacity: { readonly used: number; readonly max: number };
  readonly connectionState: "connecting" | "connected" | "closed";
}): JSX.Element {
  const isOpen = connectionState === "connected";
  const color = isOpen ? "var(--sc-cyan)" : "var(--sc-amber)";
  const label = isOpen
    ? capacity.used > 0
      ? `FLEET ACTIVE · ${capacity.used}/${capacity.max}`
      : `FLEET STANDING BY · 0/${capacity.max}`
    : connectionState === "connecting"
      ? "LINK · CONNECTING"
      : "LINK · OFFLINE";
  return (
    <span
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        fontFamily: "var(--sc-mono)",
        fontSize: 10,
        color: "var(--sc-frost)",
        padding: "5px 12px",
        border: `1px solid ${color}`,
        background: "var(--sc-cyan-ink)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        clipPath: "var(--sc-clip-sm)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          transform: "rotate(45deg)",
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function CapacityPanel({
  capacity,
  liveCount,
  planetCount,
  operativeCount,
}: {
  readonly capacity: { readonly used: number; readonly max: number };
  readonly liveCount: number;
  readonly planetCount: number;
  readonly operativeCount: number;
}): JSX.Element {
  return (
    <OctaPanel
      tone="cyan"
      size="sm"
      eyebrow={
        <>
          <Activity size={12} />
          <span>π · BUDGET</span>
        </>
      }
    >
      <div
        style={{
          fontFamily: "var(--sc-display)",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--sc-cyan)",
          letterSpacing: "0.04em",
          lineHeight: 1,
          textShadow: "0 0 8px rgba(86,212,224,0.4)",
        }}
      >
        {capacity.used}
        <em
          style={{
            fontStyle: "normal",
            color: "var(--sc-magenta)",
            textShadow: "0 0 6px rgba(255,46,136,0.4)",
            marginLeft: 6,
          }}
        >
          / {capacity.max}
        </em>
      </div>
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}
      >
        <Stat icon={<Radio size={11} />} label="LIVE" value={liveCount} />
        <Stat icon={<Boxes size={11} />} label="PLANETS" value={planetCount} />
        <Stat icon={<Users size={11} />} label="OPS" value={operativeCount} />
      </div>
    </OctaPanel>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  readonly icon: JSX.Element;
  readonly label: string;
  readonly value: number | string;
}): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "8px 10px",
        border: "1px solid var(--sc-rule-2)",
        background: "var(--sc-hull-1)",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--sc-display)",
          fontSize: 8.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--sc-steel)",
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--sc-display)",
          fontWeight: 700,
          fontSize: 18,
          color: "var(--sc-frost)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ActiveRunsPanel({
  runs,
  planetsById,
}: {
  readonly runs: Run[];
  readonly planetsById: Record<string, Planet>;
}): JSX.Element {
  return (
    <OctaPanel
      tone="magenta"
      size="sm"
      eyebrow={
        <>
          <Radio size={12} />
          <span>ACTIVE RUNS</span>
        </>
      }
    >
      {runs.length === 0 ? (
        <p
          style={{
            color: "var(--sc-steel)",
            fontFamily: "var(--sc-mono)",
            fontSize: 12,
            margin: 0,
          }}
        >
          No live runs. Hit ⌘D to deploy.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {runs.slice(0, 5).map((run) => {
            const planet = planetsById[run.planetId];
            return (
              <Link
                key={run.id}
                to={`/runs/${run.id}/cockpit`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 10px",
                  border: "1px solid var(--sc-rule-2)",
                  background: "var(--sc-hull-1)",
                  minWidth: 0,
                }}
              >
                <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
                  <strong
                    style={{
                      fontFamily: "var(--sc-display)",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      color: "var(--sc-frost)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {planet?.repoName ?? run.planetId}
                  </strong>
                  <small
                    style={{
                      fontFamily: "var(--sc-mono)",
                      fontSize: 10,
                      color: "var(--sc-steel)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {run.id} · {run.directive}
                  </small>
                </span>
                <StatusPill status={run.status} />
              </Link>
            );
          })}
        </div>
      )}
    </OctaPanel>
  );
}

function OperativesPanel({
  operatives,
  runs,
}: {
  readonly operatives: OperativeIdentity[];
  readonly runs: Run[];
}): JSX.Element {
  // Build a map operativeId -> microState from active runs.
  const microById = new Map<string, "casting" | "striking" | "idle">();
  for (const run of runs) {
    microById.set(
      run.operativeId,
      run.status === "striking" ? "striking" : "casting",
    );
  }

  return (
    <OctaPanel
      size="sm"
      eyebrow={
        <>
          <Users size={12} />
          <span>OPERATIVES · ROSTER</span>
        </>
      }
    >
      {operatives.length === 0 ? (
        <p
          style={{
            color: "var(--sc-steel)",
            fontFamily: "var(--sc-mono)",
            fontSize: 12,
            margin: 0,
          }}
        >
          No operatives recruited yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {operatives.slice(0, 4).map((op) => (
            <ReactiveOperativeTile
              key={op.id}
              operative={op}
              microState={microById.get(op.id) ?? "idle"}
            />
          ))}
          {operatives.length > 4 ? (
            <Link
              to="/roster"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 10px",
                fontFamily: "var(--sc-display)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sc-cyan)",
                border: "1px solid var(--sc-cyan-dim)",
                background: "var(--sc-cyan-ink)",
              }}
            >
              <OperativePortrait size="sm" tone="cyan" glyph="+" />
              View all {operatives.length}
            </Link>
          ) : null}
        </div>
      )}
    </OctaPanel>
  );
}

function CurrentPlanetTelemetryPanel({
  planet,
  repo,
}: {
  readonly planet: Planet | null;
  readonly repo: RegisteredRepo | null;
}): JSX.Element {
  const repoId = planet?.id ?? repo?.id;
  const telemetryQuery = useRepoTelemetry(repoId);

  if (!planet && !repo) {
    return (
      <OctaPanel
        size="sm"
        eyebrow={
          <>
            <GitBranch size={12} />
            <span>FOCUS PLANET</span>
          </>
        }
      >
        <p
          style={{
            color: "var(--sc-steel)",
            fontFamily: "var(--sc-mono)",
            fontSize: 12,
            margin: 0,
          }}
        >
          No planet to focus.
        </p>
      </OctaPanel>
    );
  }

  const repoName = planet?.repoName ?? repo?.root?.split(/[/\\]/).pop() ?? "—";

  return (
    <OctaPanel
      size="sm"
      eyebrow={
        <>
          <GitBranch size={12} />
          <span>FOCUS · {repoName}</span>
        </>
      }
      footer={
        planet ? (
          <Link
            to={`/planet/${planet.id}`}
            style={{
              fontFamily: "var(--sc-display)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sc-cyan)",
            }}
          >
            Open planet →
          </Link>
        ) : null
      }
    >
      {telemetryQuery.isLoading ? (
        <p
          style={{
            color: "var(--sc-steel)",
            fontFamily: "var(--sc-mono)",
            fontSize: 12,
            margin: 0,
          }}
          aria-busy="true"
        >
          Pulling telemetry…
        </p>
      ) : telemetryQuery.error ? (
        <p
          style={{
            color: "var(--sc-crimson)",
            fontFamily: "var(--sc-mono)",
            fontSize: 12,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          role="alert"
        >
          <AlertTriangle size={12} /> Telemetry unavailable
        </p>
      ) : (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            margin: 0,
          }}
        >
          <Telemetry
            label="branch"
            value={telemetryQuery.data?.branch ?? planet?.defaultBranch ?? "—"}
            icon={<GitBranch size={11} />}
          />
          <Telemetry
            label="age"
            value={
              telemetryQuery.data?.ageDays != null
                ? `${telemetryQuery.data.ageDays}d`
                : "—"
            }
            icon={<Leaf size={11} />}
          />
          <Telemetry
            label="tests"
            value={
              telemetryQuery.data?.testCount != null
                ? String(telemetryQuery.data.testCount)
                : "—"
            }
            icon={<Activity size={11} />}
          />
          <Telemetry
            label="last commit"
            value={fmtRelative(telemetryQuery.data?.lastCommitAt)}
            icon={<Radio size={11} />}
          />
        </dl>
      )}
      {planet && planet.scars.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--sc-amber)",
            fontFamily: "var(--sc-mono)",
            fontSize: 10.5,
            letterSpacing: "0.06em",
          }}
        >
          <AlertTriangle size={12} />
          {planet.scars.length} scar{planet.scars.length === 1 ? "" : "s"}{" "}
          carried
        </div>
      ) : null}
    </OctaPanel>
  );
}

function Telemetry({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon: JSX.Element;
}): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        padding: "8px 10px",
        border: "1px solid var(--sc-rule-2)",
        background: "var(--sc-hull-1)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--sc-display)",
          fontSize: 8.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--sc-steel)",
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--sc-mono)",
          fontSize: 12,
          color: "var(--sc-frost)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function romanize(n: number): string {
  if (n <= 0) return "0";
  const map: Array<readonly [number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let rem = Math.round(n);
  for (const [v, s] of map) {
    while (rem >= v) {
      out += s;
      rem -= v;
    }
  }
  return out;
}
