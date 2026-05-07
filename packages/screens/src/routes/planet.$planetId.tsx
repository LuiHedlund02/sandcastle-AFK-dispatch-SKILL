import type { CSSProperties, JSX } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { GitBranch, Globe2, Rocket, ShieldCheck, Skull } from "lucide-react";
import type { Planet, RegisteredRepo, Run } from "@sandcastle/protocol";
import {
  ActivityFeed,
  ChromaticHeadline,
  CommandCardView,
  CrtRasterOverlay,
  FilmGrainOverlay,
  ModeCardView,
  OctaPanel,
  PlanetSvgRenderer,
  SkillCardView,
  StatusPill,
  TelemetryGrid,
} from "@sandcastle/ui";
import {
  useActivity,
  useFleet,
  useRepoDeck,
  useRepoTelemetry,
  useRepos,
} from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

const sectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 460px)",
  gap: 18,
  minHeight: "100%",
};

const stageStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 14,
  padding: 22,
  minHeight: 0,
  overflow: "hidden",
};

const stageCanvasStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  minHeight: 0,
  background:
    "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(86,212,224,0.06), transparent 70%)",
  border: "1px solid var(--rule)",
  overflow: "hidden",
};

const deckStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  alignContent: "start",
  padding: "22px 22px 36px",
  minHeight: 0,
  overflowY: "auto",
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: "var(--display)",
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--steel)",
};

const ruleLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--rule-2)",
};

const tagListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const tagPillStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  padding: "2px 8px",
  border: "1px solid var(--rule-2)",
  background: "var(--hull-1)",
  color: "var(--mist)",
  letterSpacing: "0.04em",
};

const cardStackStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const runRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "center",
  padding: "10px 12px",
  border: "1px solid var(--rule-2)",
  background: "var(--hull-1)",
  color: "var(--frost)",
};

const muted: CSSProperties = { color: "var(--mist)" };

export function PlanetRoute(): JSX.Element {
  const { planetId } = useParams<{ planetId: string }>();
  if (!planetId) return <Navigate to="/fleet" replace />;
  return <PlanetContent planetId={planetId} />;
}

function PlanetContent({
  planetId,
}: {
  readonly planetId: string;
}): JSX.Element {
  const fleetQuery = useFleet();
  const reposQuery = useRepos();
  const deckQuery = useRepoDeck(planetId);
  const telemetryQuery = useRepoTelemetry(planetId);
  const activityQuery = useActivity(planetId, 10);

  const livePlanet = useFleetStore(
    (state) => state.fleet?.planetsById[planetId],
  );
  const liveFleet = useFleetStore((state) => state.fleet);

  const fleet = liveFleet ?? fleetQuery.data;
  const planet: Planet | undefined = livePlanet ?? fleet?.planetsById[planetId];
  const registeredRepo: RegisteredRepo | undefined =
    reposQuery.data?.repos.find((repo) => repo.id === planetId);

  const fleetLoading = !fleet && fleetQuery.isLoading;
  const reposLoading = !reposQuery.data && reposQuery.isLoading;
  const fleetError = !fleet && fleetQuery.error;
  const reposError = !reposQuery.data && reposQuery.error;

  if (fleetLoading || reposLoading) {
    return (
      <PlanetShell>
        <PlaceholderPanel tone="default" title="Acquiring planet">
          Loading fleet snapshot for {planetId}…
        </PlaceholderPanel>
      </PlanetShell>
    );
  }

  if (fleetError || reposError) {
    const message =
      (fleetError instanceof Error ? fleetError.message : null) ??
      (reposError instanceof Error ? reposError.message : null) ??
      "Unknown error";
    return (
      <PlanetShell>
        <PlaceholderPanel tone="crimson" title="Connection lost">
          Could not reach control-core: {message}
        </PlaceholderPanel>
      </PlanetShell>
    );
  }

  if (!planet || !registeredRepo) {
    return (
      <PlanetShell>
        <PlaceholderPanel tone="amber" title="Planet not charted">
          No registered repo matches <code>{planetId}</code>. It may have been
          unregistered. <Link to="/fleet">Return to the fleet</Link>.
        </PlaceholderPanel>
      </PlanetShell>
    );
  }

  const relatedRuns: Run[] = fleet
    ? Object.values(fleet.runsById)
        .filter((run) => run.planetId === planetId)
        .sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        )
    : [];

  return (
    <PlanetShell>
      <div style={sectionStyle}>
        <PlanetStage
          planet={planet}
          registeredRepo={registeredRepo}
          activeRunCount={planet.activeRunIds.length}
        />
        <PlanetDeckPanel
          planet={planet}
          registeredRepo={registeredRepo}
          deckQuery={deckQuery}
          telemetryQuery={telemetryQuery}
          activityQuery={activityQuery}
          relatedRuns={relatedRuns}
        />
      </div>
    </PlanetShell>
  );
}

function PlanetShell({
  children,
}: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <section style={{ position: "relative", minHeight: "100%" }}>
      <CrtRasterOverlay />
      <FilmGrainOverlay />
      {children}
    </section>
  );
}

function PlaceholderPanel({
  tone,
  title,
  children,
}: {
  readonly tone: "default" | "crimson" | "amber";
  readonly title: string;
  readonly children: React.ReactNode;
}): JSX.Element {
  return (
    <OctaPanel
      tone={tone}
      eyebrow={<span className="eyebrow">planet</span>}
      header={<ChromaticHeadline as="h1">{title}</ChromaticHeadline>}
    >
      <p style={muted}>{children}</p>
    </OctaPanel>
  );
}

interface PlanetStageProps {
  readonly planet: Planet;
  readonly registeredRepo: RegisteredRepo;
  readonly activeRunCount: number;
}

function PlanetStage({
  planet,
  registeredRepo,
  activeRunCount,
}: PlanetStageProps): JSX.Element {
  const stage = clamp(Math.round(planet.terraformStage), 0, 5);
  const stageRoman = ROMAN[stage] ?? `${stage}`;
  const stageLabel = STAGE_LABEL[stage] ?? "uncharted";

  return (
    <OctaPanel
      tone="cyan"
      bodyClassName=""
      eyebrow={
        <span style={sectionHeadStyle}>
          <span style={{ color: "var(--cyan)" }}>0x01</span>
          PLANET
          <span style={ruleLineStyle} />
          <span style={{ color: "var(--cyan)" }}>STAGE {stageRoman}</span>
        </span>
      }
      header={
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <ChromaticHeadline as="h1">
            <Globe2
              size={22}
              style={{
                verticalAlign: "-3px",
                marginRight: 8,
                color: "var(--cyan)",
              }}
              aria-hidden="true"
            />
            {planet.repoName}
          </ChromaticHeadline>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={tagPillStyle}>
              <GitBranch
                size={12}
                style={{ verticalAlign: "-2px", marginRight: 6 }}
                aria-hidden="true"
              />
              {planet.defaultBranch}
            </span>
            <span style={tagPillStyle}>
              <Rocket
                size={12}
                style={{ verticalAlign: "-2px", marginRight: 6 }}
                aria-hidden="true"
              />
              {activeRunCount} active
            </span>
            <span
              style={{
                ...tagPillStyle,
                color: "var(--cyan)",
                borderColor: "var(--cyan-dim)",
              }}
            >
              terraform · {stageLabel}
            </span>
          </div>
        </div>
      }
      footer={
        <small style={{ ...muted, fontFamily: "var(--mono)" }}>
          {registeredRepo.root}
        </small>
      }
    >
      <div style={stageStyle}>
        <div style={stageCanvasStyle}>
          <PlanetSvgRenderer planet={planet} size={520} />
          <BeaconLegend />
        </div>
      </div>
    </OctaPanel>
  );
}

function BeaconLegend(): JSX.Element {
  const items: Array<{ label: string; color: string }> = [
    { label: "Settlement", color: "var(--plasma)" },
    { label: "Wilderness", color: "var(--amber)" },
    { label: "Boss · scar", color: "var(--magenta)" },
    { label: "Charted", color: "var(--cyan)" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: 14,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        background: "rgba(10,16,24,0.85)",
        border: "1px solid var(--rule-2)",
        fontFamily: "var(--mono)",
        fontSize: 10,
        color: "var(--mist)",
      }}
      aria-label="Planet legend"
    >
      <span
        style={{
          fontFamily: "var(--display)",
          fontSize: 9,
          letterSpacing: "0.22em",
          color: "var(--steel)",
          marginBottom: 4,
        }}
      >
        LEGEND
      </span>
      {items.map((item) => (
        <span
          key={item.label}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              background: item.color,
              boxShadow: `0 0 4px ${item.color}`,
              transform: "rotate(45deg)",
              display: "inline-block",
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

interface PlanetDeckPanelProps {
  readonly planet: Planet;
  readonly registeredRepo: RegisteredRepo;
  readonly deckQuery: ReturnType<typeof useRepoDeck>;
  readonly telemetryQuery: ReturnType<typeof useRepoTelemetry>;
  readonly activityQuery: ReturnType<typeof useActivity>;
  readonly relatedRuns: Run[];
}

function PlanetDeckPanel({
  planet,
  registeredRepo,
  deckQuery,
  telemetryQuery,
  activityQuery,
  relatedRuns,
}: PlanetDeckPanelProps): JSX.Element {
  // Prefer freshly-fetched deck/telemetry; fall back to the snapshot copy.
  const deck = deckQuery.data ?? planet.deck;
  const telemetry = telemetryQuery.data ?? planet.telemetry;

  const deckLoading = deckQuery.isLoading && !deck;
  const telemetryLoading = telemetryQuery.isLoading && !telemetry;
  const deckError =
    deckQuery.error instanceof Error ? deckQuery.error.message : null;
  const telemetryError =
    telemetryQuery.error instanceof Error ? telemetryQuery.error.message : null;

  return (
    <div style={deckStyle}>
      <OctaPanel
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--cyan)" }}>0x02</span>
            PLANET
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>{registeredRepo.id}</span>
          </span>
        }
        header={
          <div>
            <ChromaticHeadline as="h2">{planet.repoName}</ChromaticHeadline>
            <p
              style={{
                ...muted,
                marginTop: 6,
                fontFamily: "var(--mono)",
                fontSize: 11,
              }}
            >
              <code>{registeredRepo.root}</code>
            </p>
          </div>
        }
      >
        {telemetryError ? (
          <p style={{ color: "var(--crimson)" }}>
            telemetry unavailable: {telemetryError}
          </p>
        ) : null}
        {telemetryLoading && !telemetry ? (
          <p style={muted}>Loading telemetry…</p>
        ) : null}
        {telemetry ? (
          <TelemetryGrid
            telemetry={telemetry}
            fallbackBranch={planet.defaultBranch}
          />
        ) : null}
      </OctaPanel>

      <OctaPanel
        tone="amber"
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--amber)" }}>0x03</span>
            MODE · ACTIVE
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>
              {deck.order.length} cards
            </span>
          </span>
        }
      >
        {deckLoading ? <p style={muted}>Loading deck…</p> : null}
        {deckError ? (
          <p style={{ color: "var(--crimson)" }}>
            deck unavailable: {deckError}
          </p>
        ) : null}
        {deck ? (
          <ModeCardView card={deck.mode} active={deck.mode.enabled} />
        ) : null}
      </OctaPanel>

      <OctaPanel
        tone="cyan"
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--cyan)" }}>0x04</span>
            SKILLS · PASSIVE
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>{deck.skills.length}</span>
          </span>
        }
      >
        {deck.skills.length === 0 ? (
          <p style={muted}>No skill cards equipped.</p>
        ) : (
          <div style={cardStackStyle}>
            {deck.skills.map((skill) => (
              <SkillCardView key={skill.id} card={skill} />
            ))}
          </div>
        )}
      </OctaPanel>

      <OctaPanel
        tone="magenta"
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--magenta)" }}>0x05</span>
            COMMANDS · INVOKED
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>{deck.commands.length}</span>
          </span>
        }
      >
        {deck.commands.length === 0 ? (
          <p style={muted}>No command cards equipped.</p>
        ) : (
          <div style={cardStackStyle}>
            {deck.commands.map((cmd) => (
              <CommandCardView key={cmd.id} card={cmd} />
            ))}
          </div>
        )}
      </OctaPanel>

      <OctaPanel
        tone={planet.scars.length > 0 ? "crimson" : "plasma"}
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--cyan)" }}>0x06</span>
            WARDS &amp; SCARS
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>
              {planet.wards.length} / {planet.scars.length}
            </span>
          </span>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <section aria-label="Wards">
            <header
              style={{
                ...sectionHeadStyle,
                marginBottom: 6,
                color: "var(--plasma)",
              }}
            >
              <ShieldCheck size={12} aria-hidden="true" />
              wards · {planet.wards.length}
            </header>
            {planet.wards.length === 0 ? (
              <p style={muted}>None recorded.</p>
            ) : (
              <div style={tagListStyle}>
                {planet.wards.map((w) => (
                  <span
                    key={w}
                    style={{
                      ...tagPillStyle,
                      color: "var(--plasma)",
                      borderColor: "var(--plasma-dim)",
                      background: "var(--plasma-ink)",
                    }}
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
          </section>
          <section aria-label="Scars">
            <header
              style={{
                ...sectionHeadStyle,
                marginBottom: 6,
                color: "var(--crimson)",
              }}
            >
              <Skull size={12} aria-hidden="true" />
              scars · {planet.scars.length}
            </header>
            {planet.scars.length === 0 ? (
              <p style={muted}>No scars on this planet.</p>
            ) : (
              <div style={tagListStyle}>
                {planet.scars.map((s) => (
                  <span
                    key={s}
                    style={{
                      ...tagPillStyle,
                      color: "var(--crimson)",
                      borderColor: "var(--crimson-dim)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </OctaPanel>

      <OctaPanel
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--cyan)" }}>0x07</span>
            RUNS · RECENT
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>{relatedRuns.length}</span>
          </span>
        }
      >
        {relatedRuns.length === 0 ? (
          <p style={muted}>No runs landed on this planet yet.</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 8,
            }}
          >
            {relatedRuns.slice(0, 8).map((run) => (
              <li key={run.id}>
                <Link
                  to={`/runs/${run.id}/cockpit`}
                  style={{ ...runRowStyle, textDecoration: "none" }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {run.directive}
                    </strong>
                    <small style={{ color: "var(--steel)" }}>
                      {run.id} · {run.branch}
                    </small>
                  </span>
                  <StatusPill status={run.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OctaPanel>

      <OctaPanel
        tone="cyan"
        eyebrow={
          <span style={sectionHeadStyle}>
            <span style={{ color: "var(--cyan)" }}>0x08</span>
            RECENT ACTIVITY
            <span style={ruleLineStyle} />
            <span style={{ color: "var(--mist)" }}>
              {activityQuery.data?.events.length ?? 0}
            </span>
          </span>
        }
      >
        {activityQuery.error instanceof Error ? (
          <p style={{ color: "var(--crimson)" }}>
            activity unavailable: {activityQuery.error.message}
          </p>
        ) : activityQuery.isLoading && !activityQuery.data ? (
          <p style={muted}>Loading activity…</p>
        ) : (
          <ActivityFeed events={activityQuery.data?.events ?? []} limit={10} />
        )}
      </OctaPanel>
    </div>
  );
}

const ROMAN: Record<number, string> = {
  0: "0",
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
};

const STAGE_LABEL: Record<number, string> = {
  0: "barren",
  1: "scouted",
  2: "charted",
  3: "habitable",
  4: "life-bearing",
  5: "ascendant",
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
