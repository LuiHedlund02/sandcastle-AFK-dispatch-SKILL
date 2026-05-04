import type { JSX } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  CrtRasterOverlay,
  DefeatStage,
  FilmGrainOverlay,
} from "@sandcastle/ui";
import type { Phase, Run } from "@sandcastle/protocol";
import { useDecideRun, useFleet, useRun } from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

const containerStyle = {
  position: "relative" as const,
  minHeight: "100%",
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
    // Fallback ceremony so `/runs/<any-id>/defeat` shows mockup-fidelity
    // structure even when the backing run snapshot is missing.
    return (
      <section style={containerStyle} aria-label="Defeat ceremony">
        <CrtRasterOverlay />
        <FilmGrainOverlay />
        <DefeatStage
          runId={runId}
          directive="repair the auth refresh loop · seal the leaking ward"
          xpDelta={null}
          failedChecks={["api-guard:violated", "tests:auth-refresh"]}
          causeOfDeath="API GUARD VIOLATED"
          streakBroken={3}
          graceConsumed="FIRST-REVERT GRACE · CONSUMED · NEXT REVERT WITHIN 7D = −1 LVL"
          operativeCodename="PI · KAGE"
          operativeGlyph="π"
          durationMs={420_000}
          recoveryActions={[
            {
              id: "replay",
              label: "Replay",
              variant: "ghost",
              onClick: () => navigate(`/runs/${runId}/cockpit`),
            },
            {
              id: "swap",
              label: "Swap Operative",
              variant: "default",
              onClick: () => navigate("/fleet"),
            },
            {
              id: "revise",
              label: "Revise Plan",
              variant: "amber",
              onClick: () => navigate(`/runs/${runId}/cockpit`),
            },
            {
              id: "abandon",
              label: "Abandon",
              variant: "danger",
              onClick: () => navigate("/fleet"),
            },
            {
              id: "reengage",
              label: "Re-engage",
              variant: "retry",
              onClick: () => navigate(`/runs/${runId}/cockpit`),
            },
          ]}
          onBackToFleet={() => navigate("/fleet")}
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

  // Defeat XP delta is the run's own ledger value; we don't have a dedicated
  // surface for it in the Run snapshot. Until the backend stamps xpDelta on
  // the Run, we render an honest "—" rather than a fabricated zero.
  const xpDelta = null;

  // Defeats can still emit a decision (revise/discard) when the run is
  // fail-pending; once it's terminal-defeat the buttons are advisory and
  // navigate back to the fleet.
  const canRevise =
    run.status === "fail-pending" || run.status === "win-pending";

  const failed = run.verification.failedChecks;
  const causeOfDeath = failed[0] ? failed[0].toUpperCase() : "MISSION ABORTED";

  // Streak count from the operative's record on this planet — best-effort
  // heuristic, falls back to the current victories count.
  const streakBroken = operativeRecord?.victoriesCount ?? 0;

  const recoveryActions = [
    {
      id: "replay",
      label: "Replay",
      variant: "ghost" as const,
      onClick: () => navigate(`/runs/${run.id}/cockpit`),
    },
    {
      id: "swap",
      label: "Swap Operative",
      variant: "default" as const,
      onClick: () => navigate("/fleet"),
    },
    {
      id: "revise",
      label: "Revise Plan",
      variant: "amber" as const,
      onClick: canRevise
        ? () =>
            decideRun.mutate("revise", {
              onSuccess: () => navigate(`/runs/${run.id}/cockpit`),
            })
        : () => navigate(`/runs/${run.id}/cockpit`),
    },
    {
      id: "abandon",
      label: "Abandon",
      variant: "danger" as const,
      onClick: canRevise
        ? () =>
            decideRun.mutate("discard", {
              onSuccess: () => navigate("/fleet"),
            })
        : () => navigate("/fleet"),
    },
    {
      id: "reengage",
      label: "Re-engage",
      variant: "retry" as const,
      onClick: () => navigate(`/runs/${run.id}/cockpit`),
    },
  ];

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
        causeOfDeath={causeOfDeath}
        streakBroken={streakBroken}
        graceConsumed={
          streakBroken > 0
            ? "FIRST-REVERT GRACE · CONSUMED · NEXT REVERT WITHIN 7D = −1 LVL"
            : undefined
        }
        operativeCodename={operative?.codename}
        operativeGlyph={operative?.codename.charAt(0).toUpperCase()}
        scarsEarnedHereCount={operativeRecord?.scarsEarnedHere.length}
        durationMs={durationMs}
        recoveryActions={recoveryActions}
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
