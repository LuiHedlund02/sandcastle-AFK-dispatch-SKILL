import type { JSX } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  CrtRasterOverlay,
  DefeatStage,
  FilmGrainOverlay,
  OctaPanel,
} from "@sandcastle/ui";
import type { Phase, Run } from "@sandcastle/protocol";
import { useDecideRun, useFleet, useRun } from "../api/queries";
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

export function DefeatRoute(): JSX.Element {
  const { runId } = useParams<{ runId: string }>();
  if (!runId) return <Navigate to="/fleet" replace />;
  return <DefeatContent runId={runId} />;
}

function DefeatContent({ runId }: { readonly runId: string }): JSX.Element {
  const navigate = useNavigate();
  const fleetQuery = useFleet();
  const runQuery = useRun(runId);
  const decideRun = useDecideRun(runId);

  const liveFleet = useFleetStore((state) => state.fleet);
  const fleet = liveFleet ?? fleetQuery.data;
  const liveRun = useFleetStore((state) => state.fleet?.runsById[runId]);
  const run: Run | undefined = liveRun ?? runQuery.data;
  const planet = run ? fleet?.planetsById[run.planetId] : undefined;
  const operative = run ? fleet?.operativesById[run.operativeId] : undefined;
  const operativeRecord = operative?.repoRecord;

  if (!run) {
    return (
      <section style={containerStyle}>
        <CrtRasterOverlay />
        <FilmGrainOverlay />
        <div style={{ padding: 24 }}>
          <OctaPanel
            tone="amber"
            eyebrow={<span style={eyebrowStyle}>defeat</span>}
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

  // Defeat XP delta is the run's own ledger value; we don't have a dedicated
  // surface for it in the Run snapshot. Until the backend stamps xpDelta on
  // the Run, we render an honest "—" rather than a fabricated zero.
  const xpDelta = null;

  // Defeats can still emit a decision (revise/discard) when the run is
  // fail-pending; once it's terminal-defeat the buttons are advisory and
  // navigate back to the fleet.
  const canRevise =
    run.status === "fail-pending" || run.status === "win-pending";

  return (
    <section style={containerStyle} aria-label="Defeat ceremony">
      <CrtRasterOverlay />
      <FilmGrainOverlay />
      <DefeatStage
        runId={run.id}
        directive={run.directive}
        planet={planet}
        phases={phases}
        xpDelta={xpDelta}
        failedChecks={run.verification.failedChecks}
        operativeCodename={operative?.codename}
        operativeGlyph={operative?.codename.charAt(0).toUpperCase()}
        scarsEarnedHereCount={operativeRecord?.scarsEarnedHere.length}
        durationMs={durationMs}
        onRevise={
          canRevise
            ? () => {
                decideRun.mutate("revise", {
                  onSuccess: () => navigate(`/runs/${run.id}/cockpit`),
                });
              }
            : undefined
        }
        onDiscard={
          canRevise
            ? () => {
                decideRun.mutate("discard", {
                  onSuccess: () => navigate("/fleet"),
                });
              }
            : undefined
        }
        onBackToFleet={() => navigate("/fleet")}
      />
    </section>
  );
}
