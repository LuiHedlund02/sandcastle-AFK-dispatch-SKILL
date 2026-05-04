import { useFleetStore } from "./fleetStore.js";
import { useShallow } from "zustand/shallow";
import type { OperativeMicroState } from "@sandcastle/protocol";

/**
 * Subscribe to a frozen `runId -> OperativeMicroState` map suitable for
 * passing straight into <FleetDock microStateByRunId={...} />. Uses a
 * shallow equality check so the dock only re-renders when an actual
 * state value flips, not on every unrelated event tick.
 */
export function useFleetMicroStateMap(): Record<string, OperativeMicroState> {
  return useFleetStore(
    useShallow((state) => {
      const out: Record<string, OperativeMicroState> = {};
      for (const [runId, entry] of Object.entries(state.runMicroStates)) {
        out[runId] = entry.state;
      }
      return out;
    }),
  );
}
