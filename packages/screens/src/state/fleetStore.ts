import { create } from "zustand";
import type {
  FleetState,
  OperativeMicroState,
  Run,
  RunEvent,
  WsServerMessage,
} from "@sandcastle/protocol";
import {
  decayEntry,
  makeIdleEntry,
  projectMicroState,
  type OperativeMicroEntry,
} from "./operativeMicroState.js";

type ConnectionState = "connecting" | "connected" | "closed";

interface FleetStore {
  readonly connectionState: ConnectionState;
  readonly fleet: FleetState | null;
  readonly runEvents: Record<string, RunEvent[]>;
  readonly runMicroStates: Record<string, OperativeMicroEntry>;
  readonly applyServerMessage: (message: WsServerMessage) => void;
  readonly setConnectionState: (state: ConnectionState) => void;
  /** Drop any decayed micro-states. Called by the per-run decay timers. */
  readonly tickMicroStates: (now?: number) => void;
}

const terminalStatuses = new Set(["victory", "defeat", "aborted"]);

export const useFleetStore = create<FleetStore>((set) => ({
  connectionState: "connecting",
  fleet: null,
  runEvents: {},
  runMicroStates: {},

  setConnectionState: (connectionState) => set({ connectionState }),

  tickMicroStates: (now = Date.now()) => {
    let nextDeadline: number | null = null;
    set((state) => {
      let dirty = false;
      const next: Record<string, OperativeMicroEntry> = {};
      for (const [runId, entry] of Object.entries(state.runMicroStates)) {
        const decayed = decayEntry(entry, now);
        if (decayed !== entry) dirty = true;
        if (decayed.state === "idle" && decayed.decayAt === null) {
          dirty = true;
          continue;
        }
        if (
          decayed.decayAt !== null &&
          (nextDeadline === null || decayed.decayAt < nextDeadline)
        ) {
          nextDeadline = decayed.decayAt;
        }
        next[runId] = decayed;
      }
      return dirty ? { runMicroStates: next } : state;
    });
    if (nextDeadline !== null) scheduleDecay(nextDeadline);
  },

  applyServerMessage: (message) => {
    if (message.type === "hello") {
      set({ connectionState: "connected" });
      return;
    }

    if (message.type === "fleet.snapshot") {
      set({ fleet: message.payload });
      return;
    }

    if (message.type === "run.event") {
      const now = Date.now();
      set((state) => {
        const nextEvents = {
          ...state.runEvents,
          [message.runId]: [
            ...(state.runEvents[message.runId] ?? []),
            message.event,
          ],
        };

        const nextFleet = state.fleet
          ? projectFleetEvent(state.fleet, message.runId, message.event)
          : state.fleet;

        const prevEntry = state.runMicroStates[message.runId];
        const projected = projectMicroState(prevEntry, message.event, now);
        const nextMicro =
          projected === prevEntry
            ? state.runMicroStates
            : { ...state.runMicroStates, [message.runId]: projected };

        // Schedule a decay tick when this projection introduces a deadline.
        // scheduleDecay keeps the earliest pending deadline armed, and
        // tickMicroStates re-arms the next one after each decay pass.
        if (projected !== prevEntry && projected.decayAt !== null) {
          scheduleDecay(projected.decayAt);
        }

        return {
          runEvents: nextEvents,
          fleet: nextFleet,
          runMicroStates: nextMicro,
        };
      });
    }
  },
}));

let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledFor: number | null = null;

const scheduleDecay = (at: number): void => {
  // We only need a single timer at a time — set it for the earliest decay we
  // know about. If a later event creates an earlier deadline, replace.
  if (scheduledFor !== null && scheduledFor <= at && scheduledTimer !== null) {
    return;
  }
  if (scheduledTimer !== null) {
    clearTimeout(scheduledTimer);
  }
  scheduledFor = at;
  const delay = Math.max(16, at - Date.now() + 8);
  // Best-effort: tests that do not stub timers can stub Date.now() and call
  // tickMicroStates() directly.
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null;
    scheduledFor = null;
    useFleetStore.getState().tickMicroStates();
  }, delay);
};

const projectFleetEvent = (
  fleet: FleetState,
  runId: string,
  event: RunEvent,
): FleetState => {
  const existing = fleet.runsById[runId];
  const run = projectRun(existing, runId, event);
  if (!run) return fleet;

  const runsById = { ...fleet.runsById, [runId]: run };
  const dockOrder = fleet.dockOrder.includes(runId)
    ? fleet.dockOrder
    : [...fleet.dockOrder, runId];
  const active = Object.values(runsById).filter(
    (candidate) => !terminalStatuses.has(candidate.status),
  );

  return {
    ...fleet,
    runsById,
    dockOrder,
    capacity: { ...fleet.capacity, used: active.length },
    updatedAt: new Date().toISOString(),
  };
};

const projectRun = (
  run: Run | undefined,
  runId: string,
  event: RunEvent,
): Run | undefined => {
  if (event.type === "run.started") {
    return {
      id: runId,
      planetId: "planet-local",
      operativeId: "pi-default",
      provider: run?.provider ?? "codex",
      sandboxProvider: run?.sandboxProvider ?? "host-bind-mount",
      status: "starting",
      directive: event.directive,
      branch: event.branch,
      worktreePath: event.worktreePath,
      startedAt: event.timestamp.toISOString(),
      endedAt: null,
      phaseIds: [],
      currentPhaseId: null,
      verification: { allGreen: false, failedChecks: [] },
      totals: { toolCalls: 0, filesEdited: 0, commandsRun: 0 },
    };
  }

  if (!run) return undefined;

  if (event.type === "run.statusChanged") return { ...run, status: event.to };
  if (event.type === "run.resolved") {
    return {
      ...run,
      status: event.result,
      endedAt: event.timestamp.toISOString(),
    };
  }
  if (event.type === "verification.started")
    return { ...run, status: "verifying" };
  if (event.type === "verification.finished") {
    return {
      ...run,
      status: event.allGreen ? "win-pending" : "fail-pending",
      verification: {
        allGreen: event.allGreen,
        failedChecks: [...event.failedChecks],
      },
    };
  }
  if (event.type === "tool.started") {
    return {
      ...run,
      status:
        run.status === "queued" || run.status === "starting"
          ? "casting"
          : run.status,
      totals: {
        ...run.totals,
        toolCalls: run.totals.toolCalls + 1,
        commandsRun:
          event.name === "Bash"
            ? run.totals.commandsRun + 1
            : run.totals.commandsRun,
      },
    };
  }
  if (
    event.type === "text" &&
    (run.status === "queued" || run.status === "starting")
  ) {
    return { ...run, status: "casting" };
  }
  return run;
};

/** Selector helper: micro-state for a given run, or "idle" if unknown. */
export const selectRunMicroState =
  (runId: string | undefined) =>
  (state: FleetStore): OperativeMicroState => {
    if (runId === undefined) return "idle";
    return state.runMicroStates[runId]?.state ?? "idle";
  };

/**
 * Selector helper: collapse the per-run states to a per-operative map by
 * picking the most-energetic state any of the operative's active runs is
 * currently displaying. Order: hit > crit > striking > casting > idle.
 */
const PRIORITY: Record<OperativeMicroState, number> = {
  hit: 4,
  crit: 3,
  striking: 2,
  casting: 1,
  idle: 0,
};

export const selectOperativeMicroStates =
  () =>
  (state: FleetStore): Record<string, OperativeMicroState> => {
    const out: Record<string, OperativeMicroState> = {};
    if (!state.fleet) return out;
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
  };

export { makeIdleEntry };
