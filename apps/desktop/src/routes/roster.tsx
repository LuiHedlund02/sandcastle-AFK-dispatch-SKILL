import type { CSSProperties, JSX } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  FleetState,
  OperativeIdentity,
  OperativeMicroState,
  Run,
  RunStatus,
} from "@sandcastle/protocol";
import {
  ChromaticHeadline,
  OctaPanel,
  ReactiveOperativeTile,
  StatusPill,
} from "@sandcastle/ui";
import { useFleet, useOperatives } from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

type SortMode = "level" | "bond" | "streak" | "codename";

interface DeploymentInfo {
  readonly run: Run;
  readonly micro: OperativeMicroState;
}

const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "queued",
  "starting",
  "casting",
  "striking",
  "verifying",
]);

const STATUS_TO_MICRO: Partial<Record<RunStatus, OperativeMicroState>> = {
  casting: "casting",
  starting: "casting",
  queued: "casting",
  verifying: "casting",
  striking: "striking",
};

function pickActiveRun(
  fleet: FleetState | undefined | null,
  operativeId: string,
): DeploymentInfo | null {
  if (!fleet) return null;
  for (const runId of fleet.dockOrder) {
    const run = fleet.runsById[runId];
    if (!run) continue;
    if (run.operativeId !== operativeId) continue;
    if (!ACTIVE_RUN_STATUSES.has(run.status)) continue;
    return { run, micro: STATUS_TO_MICRO[run.status] ?? "casting" };
  }
  return null;
}

function compareOperatives(
  a: OperativeIdentity,
  b: OperativeIdentity,
  mode: SortMode,
): number {
  switch (mode) {
    case "level":
      return b.level - a.level || a.codename.localeCompare(b.codename);
    case "bond":
      return b.bond - a.bond || a.codename.localeCompare(b.codename);
    case "streak":
      return b.streak - a.streak || a.codename.localeCompare(b.codename);
    case "codename":
      return a.codename.localeCompare(b.codename);
  }
}

const rosterStyles = {
  layout: {
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: 18,
    minHeight: "100%",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  subline: {
    color: "var(--mist)",
    fontSize: 12,
    letterSpacing: "0.02em",
    maxWidth: 640,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  toolbarLabel: {
    color: "var(--steel)",
    fontFamily: "var(--display)",
    fontSize: 10,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  sortGroup: {
    display: "flex",
    border: "1px solid var(--rule-2)",
    background: "var(--hull-1)",
    padding: 2,
    gap: 1,
    clipPath:
      "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
  },
  sortButton: {
    appearance: "none",
    background: "transparent",
    color: "var(--steel)",
    fontFamily: "var(--display)",
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    padding: "5px 11px",
    cursor: "pointer",
    border: "1px solid transparent",
  },
  sortButtonActive: {
    color: "var(--magenta)",
    background: "linear-gradient(180deg, var(--hull-3), var(--hull-2))",
    boxShadow: "inset 0 0 0 0.5px var(--magenta-dim)",
    borderColor: "var(--magenta-dim)",
  },
  countChip: {
    border: "1px solid var(--rule-2)",
    background: "var(--hull-1)",
    color: "var(--cyan)",
    fontFamily: "var(--mono)",
    fontSize: 11,
    letterSpacing: "0.05em",
    padding: "3px 9px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 14,
    alignContent: "start",
  },
  tileFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid var(--rule)",
    fontFamily: "var(--mono)",
    fontSize: 10.5,
    color: "var(--mist)",
    letterSpacing: "0.04em",
  },
  tileFooterStat: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  tileFooterLabel: {
    color: "var(--steel)",
    fontFamily: "var(--display)",
    fontSize: 8.5,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  tileFooterValue: {
    color: "var(--frost)",
  },
  empty: {
    display: "grid",
    placeItems: "center",
    minHeight: 320,
    color: "var(--steel)",
    textAlign: "center",
    padding: 32,
  },
  emptyTitle: {
    color: "var(--cyan)",
    fontFamily: "var(--display)",
    fontSize: 14,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emptyBody: {
    color: "var(--mist)",
    fontSize: 12,
    maxWidth: 480,
    lineHeight: 1.55,
  },
  errorPanel: {
    color: "var(--crimson)",
    fontSize: 12,
    lineHeight: 1.5,
  },
  loadingPanel: {
    color: "var(--mist)",
    fontSize: 12,
  },
  deploymentRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
} satisfies Record<string, CSSProperties>;

const SORT_MODES: ReadonlyArray<{
  readonly id: SortMode;
  readonly label: string;
}> = [
  { id: "level", label: "Level" },
  { id: "bond", label: "Bond" },
  { id: "streak", label: "Streak" },
  { id: "codename", label: "A-Z" },
];

interface TileProps {
  readonly operative: OperativeIdentity;
  readonly deployment: DeploymentInfo | null;
}

function RosterTile({ operative, deployment }: TileProps): JSX.Element {
  const navigate = useNavigate();
  const micro: OperativeMicroState = deployment?.micro ?? "idle";
  return (
    <ReactiveOperativeTile
      operative={operative}
      microState={micro}
      onSelect={(op) => navigate(`/operatives/${op.id}`)}
      footer={
        <div style={rosterStyles.tileFooter}>
          <div style={rosterStyles.tileFooterStat}>
            <span style={rosterStyles.tileFooterLabel}>Bond</span>
            <span style={rosterStyles.tileFooterValue}>
              {operative.bond.toFixed(2)}
            </span>
          </div>
          <div style={rosterStyles.tileFooterStat}>
            <span style={rosterStyles.tileFooterLabel}>Streak</span>
            <span style={rosterStyles.tileFooterValue}>{operative.streak}</span>
          </div>
          <div style={rosterStyles.tileFooterStat}>
            <span style={rosterStyles.tileFooterLabel}>Provider</span>
            <span style={rosterStyles.tileFooterValue}>
              {operative.provider}
            </span>
          </div>
          {deployment ? (
            <div
              style={{
                ...rosterStyles.tileFooterStat,
                alignItems: "flex-end",
              }}
            >
              <span style={rosterStyles.tileFooterLabel}>Deployed</span>
              <span style={rosterStyles.deploymentRow}>
                <StatusPill status={deployment.run.status} />
              </span>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

export function RosterRoute(): JSX.Element {
  const operativesQuery = useOperatives();
  const fleetQuery = useFleet();
  const liveFleet = useFleetStore((state) => state.fleet);
  const fleet = liveFleet ?? fleetQuery.data ?? null;

  const [sortMode, setSortMode] = useState<SortMode>("level");

  const operatives = operativesQuery.data?.operatives ?? [];

  const sorted = useMemo(() => {
    return [...operatives].sort((a, b) => compareOperatives(a, b, sortMode));
  }, [operatives, sortMode]);

  const isLoading = operativesQuery.isLoading;
  const error = operativesQuery.error;

  if (isLoading && operatives.length === 0) {
    return (
      <section style={rosterStyles.layout}>
        <OctaPanel
          eyebrow={<span className="eyebrow">roster</span>}
          tone="cyan"
        >
          <div style={rosterStyles.loadingPanel}>
            Loading operative bullpen…
          </div>
        </OctaPanel>
      </section>
    );
  }

  if (error && operatives.length === 0) {
    return (
      <section style={rosterStyles.layout}>
        <OctaPanel
          eyebrow={<span className="eyebrow">roster</span>}
          tone="crimson"
        >
          <div style={rosterStyles.errorPanel}>
            Failed to load operatives: {error.message}
          </div>
        </OctaPanel>
      </section>
    );
  }

  return (
    <section style={rosterStyles.layout} aria-labelledby="roster-headline">
      <OctaPanel
        eyebrow={<span className="eyebrow">roster ／ operative bullpen</span>}
      >
        <div style={rosterStyles.header}>
          <div style={rosterStyles.headerLeft}>
            <ChromaticHeadline as="h1" glitch>
              <span id="roster-headline">Operative bullpen</span>
            </ChromaticHeadline>
            <p style={rosterStyles.subline}>
              Every operative under your command. Tap a tile to open the dossier
              — chassis, bond, scars, and unlocked traits.
            </p>
          </div>

          <div style={rosterStyles.toolbar}>
            <span style={rosterStyles.toolbarLabel}>Sort</span>
            <div
              style={rosterStyles.sortGroup}
              role="group"
              aria-label="Sort operatives"
            >
              {SORT_MODES.map((mode) => {
                const isActive = mode.id === sortMode;
                const style: CSSProperties = isActive
                  ? {
                      ...rosterStyles.sortButton,
                      ...rosterStyles.sortButtonActive,
                    }
                  : rosterStyles.sortButton;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    style={style}
                    aria-pressed={isActive}
                    onClick={() => setSortMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <span style={rosterStyles.countChip} aria-label="Operative count">
              {operatives.length.toString().padStart(2, "0")} live
            </span>
          </div>
        </div>
      </OctaPanel>

      {sorted.length === 0 ? (
        <OctaPanel tone="cyan">
          <div style={rosterStyles.empty}>
            <div>
              <div style={rosterStyles.emptyTitle}>Bullpen is empty</div>
              <div style={rosterStyles.emptyBody}>
                No operatives are seeded for this control-core yet. The
                installer normally provisions <strong>π-default</strong> on
                first boot. If you see this, control-core may still be
                initialising — refresh once the dock reports connected.
              </div>
            </div>
          </div>
        </OctaPanel>
      ) : (
        <div style={rosterStyles.grid} role="list">
          {sorted.map((operative) => {
            const deployment = pickActiveRun(fleet, operative.id);
            return (
              <div role="listitem" key={operative.id}>
                <RosterTile operative={operative} deployment={deployment} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
