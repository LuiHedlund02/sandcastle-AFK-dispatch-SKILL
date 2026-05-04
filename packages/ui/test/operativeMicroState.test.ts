import { describe, expect, it } from "vitest";
import type { RunEvent } from "@sandcastle/protocol";
import {
  decayEntry,
  makeIdleEntry,
  projectMicroState,
  STRIKING_TOOL_NAMES,
} from "../../screens/src/state/operativeMicroState.js";

const T0 = 1_700_000_000_000;

const baseEvent = (
  iter: number,
  partial: Partial<RunEvent> & { type: RunEvent["type"] },
): RunEvent =>
  ({
    iteration: iter,
    timestamp: new Date(T0 + iter * 1000),
    ...partial,
  }) as RunEvent;

describe("projectMicroState", () => {
  it("starts in idle when no prior entry exists", () => {
    const next = projectMicroState(
      undefined,
      baseEvent(1, { type: "text", message: "hi" }),
      T0,
    );
    expect(next.state).toBe("casting");
    expect(next.decayAt).not.toBeNull();
    expect(next.decayTo).toBe("idle");
  });

  it("text → casting (~600ms decay)", () => {
    const next = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, { type: "text", message: "hello" }),
      T0,
    );
    expect(next.state).toBe("casting");
    expect(next.decayAt).toBe(T0 + 600);
  });

  it("tool.started Edit → striking", () => {
    expect(STRIKING_TOOL_NAMES.has("Edit")).toBe(true);
    const next = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "tool.started",
        name: "Edit",
        formattedArgs: "",
        toolCallId: "t1",
      }),
      T0,
    );
    expect(next.state).toBe("striking");
  });

  it("tool.started Read → casting (non-edit tool)", () => {
    const next = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "tool.started",
        name: "Read",
        formattedArgs: "",
        toolCallId: "t1",
      }),
      T0,
    );
    expect(next.state).toBe("casting");
  });

  it("tool.finished error → hit", () => {
    const prev = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "tool.started",
        name: "Bash",
        formattedArgs: "",
        toolCallId: "t1",
      }),
      T0,
    );
    const next = projectMicroState(
      prev,
      baseEvent(2, {
        type: "tool.finished",
        name: "Bash",
        toolCallId: "t1",
        durationMs: 100,
        ok: false,
      }),
      T0 + 1,
    );
    expect(next.state).toBe("hit");
    expect(next.decayAt).toBe(T0 + 1 + 800);
  });

  it("tool.finished success → casting (then decays)", () => {
    const prev = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "tool.started",
        name: "Edit",
        formattedArgs: "",
        toolCallId: "t1",
      }),
      T0,
    );
    const next = projectMicroState(
      prev,
      baseEvent(2, {
        type: "tool.finished",
        name: "Edit",
        toolCallId: "t1",
        durationMs: 50,
        ok: true,
      }),
      T0 + 1,
    );
    expect(next.state).toBe("casting");
  });

  it("verification.finished allGreen → crit", () => {
    const next = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "verification.finished",
        allGreen: true,
        failedChecks: [],
      }),
      T0,
    );
    expect(next.state).toBe("crit");
    expect(next.decayAt).toBe(T0 + 500);
  });

  it("verification.finished failed → hit", () => {
    const next = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "verification.finished",
        allGreen: false,
        failedChecks: ["typecheck"],
      }),
      T0,
    );
    expect(next.state).toBe("hit");
  });

  it("decision.required → crit", () => {
    const next = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, { type: "decision.required", kind: "merge" }),
      T0,
    );
    expect(next.state).toBe("crit");
  });

  it("run.resolved → idle", () => {
    const prev = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "verification.finished",
        allGreen: true,
        failedChecks: [],
      }),
      T0,
    );
    const next = projectMicroState(
      prev,
      baseEvent(2, {
        type: "run.resolved",
        runId: "run_1",
        result: "victory",
        xpDelta: 10,
      }),
      T0 + 1,
    );
    expect(next.state).toBe("idle");
    expect(next.decayAt).toBeNull();
  });

  it("is idempotent on identical iterations", () => {
    const evt = baseEvent(1, { type: "text", message: "x" });
    const a = projectMicroState(makeIdleEntry(), evt, T0);
    const b = projectMicroState(a, evt, T0 + 1000);
    expect(b).toBe(a);
  });

  it("hit suppresses competing casting from a stray text event", () => {
    const prev = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, {
        type: "verification.finished",
        allGreen: false,
        failedChecks: ["x"],
      }),
      T0,
    );
    expect(prev.state).toBe("hit");
    const next = projectMicroState(
      prev,
      baseEvent(2, { type: "text", message: "another line" }),
      T0 + 100,
    );
    expect(next.state).toBe("hit");
  });

  it("decayEntry collapses to fallback after window", () => {
    const entry = projectMicroState(
      makeIdleEntry(),
      baseEvent(1, { type: "text", message: "x" }),
      T0,
    );
    const same = decayEntry(entry, T0 + 100);
    expect(same).toBe(entry);
    const decayed = decayEntry(entry, T0 + 700);
    expect(decayed.state).toBe("idle");
  });
});
