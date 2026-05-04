import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunEvent, WsServerMessage } from "@sandcastle/protocol";
import {
  selectRunMicroState,
  useFleetStore,
} from "../../screens/src/state/fleetStore.js";

const T0 = 1_700_000_000_000;

const runEvent = (runId: string, event: RunEvent): WsServerMessage => ({
  type: "run.event",
  runId,
  event,
});

const baseEvent = (
  iteration: number,
  partial: Partial<RunEvent> & { type: RunEvent["type"] },
): RunEvent =>
  ({
    iteration,
    timestamp: new Date(T0 + iteration),
    ...partial,
  }) as RunEvent;

const resetFleetStore = (): void => {
  useFleetStore.setState({
    connectionState: "connecting",
    fleet: null,
    runEvents: {},
    runMicroStates: {},
  });
};

describe("useFleetStore micro-state decay", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    resetFleetStore();
  });

  it("re-arms decay timers for later pending run deadlines", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    resetFleetStore();

    useFleetStore
      .getState()
      .applyServerMessage(
        runEvent(
          "run-later",
          baseEvent(1, { type: "text", message: "working" }),
        ),
      );
    useFleetStore.getState().applyServerMessage(
      runEvent(
        "run-earlier",
        baseEvent(2, {
          type: "verification.finished",
          allGreen: true,
          failedChecks: [],
        }),
      ),
    );

    vi.advanceTimersByTime(650);

    const state = useFleetStore.getState();
    expect(selectRunMicroState("run-earlier")(state)).toBe("idle");
    expect(selectRunMicroState("run-later")(state)).toBe("idle");
    expect(state.runMicroStates).toEqual({});
  });
});
