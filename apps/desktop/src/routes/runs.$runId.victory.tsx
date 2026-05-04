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
    return (
      <section style={containerStyle}>
        <CrtRasterOverlay />
        <FilmGrainOverlay />
        <div style={{ padding: 24 }}>
          <OctaPanel
            tone="amber"
            eyebrow={<span style={eyebrowStyle}>victory</span>}
          >
            <p>
              {runQuery.isLoading
                ? "Loading run…"
                : runQuery.error instanceof Error
                  ? `Run not found: ${runQuery.error.message}`
                  : "Awaiting run snapshot."}
            </p>
          </OctaPanel>
        </div>
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
