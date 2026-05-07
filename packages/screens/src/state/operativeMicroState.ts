import type { OperativeMicroState, RunEvent } from "@sandcastle/protocol";

/**
 * Tool names that escalate the operative tile to "striking" — write/edit/run
 * style tools. Anything else (Read, Grep, Glob, web fetch lookups, etc.) is
 * treated as cogitation and stays in "casting".
 */
export const STRIKING_TOOL_NAMES: ReadonlySet<string> = new Set([
  "Edit",
  "Write",
  "MultiEdit",
  "Bash",
  "NotebookEdit",
]);

/** Per-run book-keeping for the reactive tile state machine. */
export interface OperativeMicroEntry {
  /** Visible state right now. */
  readonly state: OperativeMicroState;
  /**
   * Wall-clock timestamp (ms) at which the current state should auto-decay
   * back to {@link decayTo}. `null` means the state is sticky (e.g. idle, or
   * sustained casting from a long-running tool — refreshed by each event).
   */
  readonly decayAt: number | null;
  /** State to fall back to when {@link decayAt} elapses. */
  readonly decayTo: OperativeMicroState;
  /**
   * Timestamp (ms) of the last event we projected. Used to make the
   * projection idempotent — re-applying an event with the same iteration
   * timestamp leaves the entry untouched.
   */
  readonly lastIteration: number | null;
}

const IDLE_ENTRY: OperativeMicroEntry = {
  state: "idle",
  decayAt: null,
  decayTo: "idle",
  lastIteration: null,
};

/** Default duration each non-idle state holds before falling back. */
const DURATIONS = {
  casting: 600, // text / read-only tool — short echo
  striking: 600, // edit/write/bash — short echo
  crit: 500, // verification.passed / decision.required pop
  hit: 800, // verification.failed / tool error shake
} as const satisfies Record<Exclude<OperativeMicroState, "idle">, number>;

export function makeIdleEntry(): OperativeMicroEntry {
  return IDLE_ENTRY;
}

/** Inspect a tool.finished event for a non-success indicator. */
const isFailedFinish = (event: RunEvent): boolean => {
  if (event.type !== "tool.finished") return false;
  return event.ok === false;
};

const eventIteration = (event: RunEvent): number | null => {
  return typeof event.iteration === "number" ? event.iteration : null;
};

/**
 * Pure projection: given the previous entry and one event, return the next
 * entry. Idempotent — applying the same event twice (same `iteration`) is
 * a no-op.
 *
 * `now` is wall-clock ms (caller passes Date.now() in production, fixed
 * values in tests).
 */
export function projectMicroState(
  prev: OperativeMicroEntry | undefined,
  event: RunEvent,
  now: number,
): OperativeMicroEntry {
  const current = prev ?? IDLE_ENTRY;
  const it = eventIteration(event);
  if (
    it !== null &&
    current.lastIteration !== null &&
    it === current.lastIteration
  ) {
    return current;
  }

  const next = computeNextState(current, event, now);
  if (next === null) {
    // Event is not state-relevant; just remember the iteration so a re-apply
    // is idempotent without disturbing decay timing.
    return it !== null ? { ...current, lastIteration: it } : current;
  }
  return { ...next, lastIteration: it ?? current.lastIteration };
}

/**
 * Decay an entry against the wall clock. If its decay window has elapsed,
 * collapse to the fallback state. Pure.
 */
export function decayEntry(
  entry: OperativeMicroEntry,
  now: number,
): OperativeMicroEntry {
  if (entry.decayAt === null) return entry;
  if (now < entry.decayAt) return entry;
  if (entry.state === entry.decayTo) return entry;
  return {
    state: entry.decayTo,
    decayAt: null,
    decayTo: entry.decayTo,
    lastIteration: entry.lastIteration,
  };
}

function computeNextState(
  current: OperativeMicroEntry,
  event: RunEvent,
  now: number,
): Omit<OperativeMicroEntry, "lastIteration"> | null {
  switch (event.type) {
    case "text":
      // Don't downgrade an in-flight strike/crit/hit; refresh casting if we
      // were already casting.
      if (current.state === "striking") {
        return {
          state: "striking",
          decayAt: now + DURATIONS.striking,
          decayTo: "idle",
        };
      }
      if (current.state === "crit" || current.state === "hit") {
        return null;
      }
      return {
        state: "casting",
        decayAt: now + DURATIONS.casting,
        decayTo: "idle",
      };

    case "tool.started": {
      const isStriking = STRIKING_TOOL_NAMES.has(event.name);
      const target: OperativeMicroState = isStriking ? "striking" : "casting";
      // Don't override a hit/crit mid-flash.
      if (current.state === "crit" || current.state === "hit") return null;
      return {
        state: target,
        decayAt: now + DURATIONS[target],
        decayTo: "idle",
      };
    }

    case "tool.finished":
      if (isFailedFinish(event)) {
        return {
          state: "hit",
          decayAt: now + DURATIONS.hit,
          decayTo: "idle",
        };
      }
      // Successful finish: brief echo back through casting, then idle.
      if (current.state === "crit" || current.state === "hit") return null;
      return {
        state: "casting",
        decayAt: now + DURATIONS.casting,
        decayTo: "idle",
      };

    case "verification.finished":
      if (event.allGreen) {
        return {
          state: "crit",
          decayAt: now + DURATIONS.crit,
          decayTo: "idle",
        };
      }
      return {
        state: "hit",
        decayAt: now + DURATIONS.hit,
        decayTo: "idle",
      };

    case "phase.failed":
      return {
        state: "hit",
        decayAt: now + DURATIONS.hit,
        decayTo: "idle",
      };

    case "phase.verified":
      if (current.state === "hit") return null;
      return {
        state: "crit",
        decayAt: now + DURATIONS.crit,
        decayTo: "idle",
      };

    case "decision.required":
      if (current.state === "hit") return null;
      return {
        state: "crit",
        decayAt: now + DURATIONS.crit,
        decayTo: "idle",
      };

    case "run.resolved":
      return {
        state: "idle",
        decayAt: null,
        decayTo: "idle",
      };

    case "run.statusChanged":
      // Status changes are just bookkeeping for the run list; the visual
      // micro-state is event-driven, not status-driven.
      return null;

    default:
      return null;
  }
}
