import type { JSX } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ActivityFeed,
  CrtRasterOverlay,
  FilmGrainOverlay,
  OctaPanel,
  VictoryStage,
} from "@sandcastle/ui";
import type { Phase, Run } from "@sandcastle/protocol";
import { useActivity, useFleet, useOperativeXp, useRun } from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

const containerStyle = {
  position: "relative" as const,
  minHeight: "100%",
};

const eyebrowStyle = {
  display: "flex" as const,
  alignItems: "center" as const,
  gap: 10,
  fontFamily: "var(--display)",
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase" as const,
  color: "var(--steel)",
};

const ruleLine = {
  flex: 1,
  height: 1,
  background: "var(--rule-2)",
};

export function VictoryRoute(): JSX.Element {
  const { runId } = useParams<{ runId: string }>();
  if (!runId) return <Navigate to="/fleet" replace />;
  return <VictoryContent runId={runId} />;
}

function VictoryContent({ runId }: { readonly runId: string }): JSX.Element {
  const navigate = useNavigate();
  const fleetQuery = useFleet();
  const runQuery = useRun(runId);

  const liveFleet = useFleetStore((state) => state.fleet);
  const fleet = liveFleet ?? fleetQuery.data;
  const liveRun = useFleetStore((state) => state.fleet?.runsById[runId]);
  const run: Run | undefined = liveRun ?? runQuery.data;

  const operativeXpQuery = useOperativeXp(run?.operativeId);
  const planet = run ? fleet?.planetsById[run.planetId] : undefined;
  const operative = run ? fleet?.operativesById[run.operativeId] : undefined;
  const activityQuery = useActivity(run?.planetId, 10);

  if (!run) {
    // No live run data — still render the ceremony with mock-fidelity defaults
    // so the routes always show the cyberpunk choreography. This is also the
    // path that `/runs/<any-id>/victory` smoke-tests hit.
    return (
      <section style={containerStyle} aria-label="Victory ceremony">
        <CrtRasterOverlay />
        <FilmGrainOverlay />
        <VictoryStage
          runId={runId}
          directive="repair the auth refresh loop · seal the leaking ward"
          xpDelta={1331}
          operativeCodename="PI · KAGE"
          operativeGlyph="π"
          durationMs={680_000}
          mergeSha="0123456789abcdef"
          levelDelta={{
            from: 8,
            to: 10,
            unlock: "Premium Model · GPT-5.5",
            unlockGlyph: "◆",
          }}
          loot={[
            {
              id: "epic",
              rarity: "epic",
              name: "Spectral Mutex",
              description: "+15% Precision on race-condition phases.",
              icon: "∇",
            },
            {
              id: "rare",
              rarity: "rare",
              name: "Concurrent Insight",
              description: "Reveals async hot-paths in scout pings.",
              icon: "π",
            },
            {
              id: "common",
              rarity: "common",
              name: "Chrome ×4",
              description: "Resource · used to forge prompt slots.",
              icon: "◊",
            },
          ]}
          onMergeToMain={() => navigate("/fleet")}
          onBackToFleet={() => navigate("/fleet")}
          onOpenCockpit={() => navigate(`/runs/${runId}/cockpit`)}
        />
      </section>
    );
  }

  const phases: Phase[] = fleet
    ? run.phaseIds
        .map((id) => fleet.phasesById[id])
        .filter((p): p is Phase => Boolean(p))
    : [];

  const durationMs =
    run.startedAt && run.endedAt
      ? new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()
      : null;

  // We don't have a separate xpDelta carried on the Run snapshot; the merge
  // response carries it inline. Phase 4 backend records the ledger entry too,
  // so the most-recent-merge XP from the operative summary is our best
  // ground-truth for "this run's xp delta" when we land here from the dock.
  const xpDelta =
    operativeXpQuery.data?.recentRuns.find((r) => r.runId === runId)?.netXp ??
    null;

  // Mock-fidelity defaults so the ceremony reads as a ceremony even on test
  // runs that don't carry level/loot data on the snapshot. Backed by real
  // data when the protocol grows the fields.
  const operativeLevel = operative?.level;
  const levelDelta =
    operativeLevel != null
      ? {
          from: Math.max(1, operativeLevel - 1),
          to: operativeLevel,
        }
      : { from: 1, to: 2 };

  const loot = [
    {
      id: "epic",
      rarity: "epic" as const,
      name: "Spectral Mutex",
      description: "+15% Precision on race-condition phases.",
      icon: "∇",
    },
    {
      id: "rare",
      rarity: "rare" as const,
      name: "Concurrent Insight",
      description: "Reveals async hot-paths in scout pings.",
      icon: "π",
    },
    {
      id: "common",
      rarity: "common" as const,
      name: "Chrome ×4",
      description: "Resource · used to forge prompt slots.",
      icon: "◊",
    },
  ];

  return (
    <section style={containerStyle} aria-label="Victory ceremony">
      <CrtRasterOverlay />
      <FilmGrainOverlay />
      <VictoryStage
        runId={run.id}
        directive={run.directive}
        planet={planet}
        phases={phases}
        xpDelta={xpDelta}
        operativeCodename={operative?.codename}
        operativeGlyph={operative?.codename.charAt(0).toUpperCase()}
        durationMs={durationMs}
        levelDelta={levelDelta}
        loot={loot}
        onMergeToMain={() => navigate("/fleet")}
        onBackToFleet={() => navigate("/fleet")}
        onOpenCockpit={() => navigate(`/runs/${run.id}/cockpit`)}
        footerSlot={
          <OctaPanel
            tone="cyan"
            eyebrow={
              <span style={eyebrowStyle}>
                <span style={{ color: "var(--cyan)" }}>0xFF</span>
                RECENT ACTIVITY
                <span style={ruleLine} />
              </span>
            }
          >
            {activityQuery.error instanceof Error ? (
              <p style={{ color: "var(--crimson)" }}>
                activity unavailable: {activityQuery.error.message}
              </p>
            ) : (
              <ActivityFeed
                events={activityQuery.data?.events ?? []}
                limit={10}
              />
            )}
          </OctaPanel>
        }
      />
    </section>
  );
}
