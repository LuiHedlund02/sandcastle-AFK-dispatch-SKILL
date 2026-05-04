import type { JSX } from "react";
import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  CombatHud,
  CombatStage,
  PhaseRound,
  buildVerifyEntriesFromResults,
} from "@sandcastle/ui";
import type { Phase, RunEvent, VerifyRuleResult } from "@sandcastle/protocol";
import { useRun } from "../api/queries";
import { useFleetStore } from "../state/fleetStore";

export function CombatRoute(): JSX.Element {
  const { runId } = useParams();
  if (!runId) return <Navigate to="/" replace />;
  return <CombatContent runId={runId} />;
}

function CombatContent({ runId }: { readonly runId: string }): JSX.Element {
  const { data: fetchedRun, isLoading, error } = useRun(runId);
  const storeRun = useFleetStore((state) => state.fleet?.runsById[runId]);
  const phasesById = useFleetStore((state) => state.fleet?.phasesById ?? {});
  const events = useFleetStore((state) => state.runEvents[runId] ?? []);
  const run = storeRun ?? fetchedRun;

  const phases = useMemo<Phase[]>(() => {
    if (!run) return [];
    return run.phaseIds
      .map((id) => phasesById[id])
      .filter((p): p is Phase => p !== undefined)
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);
  }, [run, phasesById]);

  const eventsByPhase = useMemo(() => groupEventsByPhase(events), [events]);

  const verifyResultsByPhaseId = useMemo(
    () => collectVerifyResults(events),
    [events],
  );

  const verifyEntries = useMemo(
    () => buildVerifyEntriesFromResults(phases, verifyResultsByPhaseId),
    [phases, verifyResultsByPhaseId],
  );

  if (isLoading && !run) {
    return <div className="panel cockpit-placeholder">Loading run {runId}</div>;
  }

  if (error && !run) {
    return (
      <div className="panel cockpit-placeholder">
        Run not found: {error.message}
      </div>
    );
  }

  if (!run) {
    return (
      <div className="panel cockpit-placeholder">
        Waiting for run snapshot {runId}
      </div>
    );
  }

  return (
    <section className="combat-route" aria-label={`Combat for run ${runId}`}>
      <CombatStage
        runId={run.id}
        operativeName={run.operativeId}
        planetName={run.planetId}
        statusLabel={run.status}
        bannerActions={
          <Link
            to={`/runs/${encodeURIComponent(run.id)}/cockpit`}
            className="combat-route__view-link"
          >
            Cockpit view
          </Link>
        }
        hud={
          <CombatHud run={run} phases={phases} verifyEntries={verifyEntries} />
        }
      >
        {phases.length === 0
          ? null
          : phases.map((phase) => {
              const phaseEvents = eventsByPhase[phase.id] ?? [];
              const verifyResults = verifyResultsByPhaseId[phase.id] ?? [];
              return (
                <PhaseRound
                  key={phase.id}
                  phase={phase}
                  toolEvents={phaseEvents}
                  verifyResults={verifyResults}
                />
              );
            })}
      </CombatStage>
    </section>
  );
}

/**
 * Bucket `tool.started` / `tool.finished` / `toolCall` events into the most
 * recent `phase.started` window. We rely on the event sequence order — the
 * backend always emits phase.started before that phase's tools.
 */
function groupEventsByPhase(
  events: readonly RunEvent[],
): Readonly<Record<string, readonly RunEvent[]>> {
  const out: Record<string, RunEvent[]> = {};
  let currentPhaseId: string | null = null;
  for (const event of events) {
    if (event.type === "phase.started") {
      currentPhaseId = event.phaseId;
      if (!out[currentPhaseId]) out[currentPhaseId] = [];
      continue;
    }
    if (
      currentPhaseId &&
      (event.type === "tool.started" ||
        event.type === "tool.finished" ||
        event.type === "toolCall")
    ) {
      const bucket = out[currentPhaseId];
      if (bucket) bucket.push(event);
    }
  }
  return out;
}

function collectVerifyResults(
  events: readonly RunEvent[],
): Readonly<Record<string, readonly VerifyRuleResult[]>> {
  const out: Record<string, VerifyRuleResult[]> = {};
  for (const event of events) {
    if (event.type === "phase.verified" || event.type === "phase.failed") {
      out[event.phaseId] = [...event.results];
    }
  }
  return out;
}
