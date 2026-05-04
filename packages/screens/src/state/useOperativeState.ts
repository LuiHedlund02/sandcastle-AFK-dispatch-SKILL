import { useFleetStore, selectRunMicroState } from "./fleetStore.js";
import type { OperativeMicroState } from "@sandcastle/protocol";

/**
 * Subscribe to the live micro-state for one run. Returns "idle" when no run
 * is in flight or the store has not yet observed any events for it.
 */
export function useRunMicroState(
  runId: string | undefined,
): OperativeMicroState {
  return useFleetStore(selectRunMicroState(runId));
}

/**
 * Subscribe to the per-operative micro-state map (operativeId -> state),
 * derived from any active runs that operative owns. Useful for the roster
 * panel where a single operative may have multiple runs in flight.
 */
export function useOperativeMicroStates(): Record<string, OperativeMicroState> {
  return useFleetStore((state) => {
    const out: Record<string, OperativeMicroState> = {};
    if (!state.fleet) return out;
    const PRIORITY: Record<OperativeMicroState, number> = {
      hit: 4,
      crit: 3,
      striking: 2,
      casting: 1,
      idle: 0,
    };
    for (const runId of Object.keys(state.runMicroStates)) {
      const run = state.fleet.runsById[runId];
      if (!run) continue;
      const micro = state.runMicroStates[runId]?.state ?? "idle";
      const prev = out[run.operativeId];
      if (prev === undefined || PRIORITY[micro] > PRIORITY[prev]) {
        out[run.operativeId] = micro;
      }
    }
    return out;
  });
}
