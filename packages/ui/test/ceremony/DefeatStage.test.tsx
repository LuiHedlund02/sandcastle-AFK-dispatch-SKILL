import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DefeatStage } from "../../src/index.js";
import type { Phase } from "@sandcastle/protocol";

afterEach(() => {
  cleanup();
});

function makePhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "phase_1",
    runId: "run_d",
    ordinal: 1,
    title: "Reproduce the loop",
    directiveSlice: "phase 1",
    objective: "make the bug deterministic",
    xpEstimate: 50,
    verifyRules: [],
    status: "verified",
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

describe("DefeatStage", () => {
  it("renders DEFEAT headline + failed-checks list + revise/discard buttons", () => {
    const onRevise = vi.fn();
    const onDiscard = vi.fn();
    render(
      <DefeatStage
        runId="run_d"
        directive="repair the auth refresh loop"
        xpDelta={-40}
        failedChecks={["typecheck", "tests:auth-refresh"]}
        operativeCodename="PI · KAGE"
        onRevise={onRevise}
        onDiscard={onDiscard}
      />,
    );

    // Headline
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /DEFEAT/i,
    );

    // Failed checks rendered honestly
    expect(screen.getByText("typecheck")).toBeDefined();
    expect(screen.getByText("tests:auth-refresh")).toBeDefined();

    // Action buttons fire the right handlers
    fireEvent.click(screen.getByRole("button", { name: /revise/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onRevise).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("highlights the failed phase in the phase log", () => {
    const phases: Phase[] = [
      makePhase({ id: "p1", ordinal: 1, status: "verified" }),
      makePhase({
        id: "p2",
        ordinal: 2,
        status: "failed",
        title: "Patch · serialize callers",
      }),
      makePhase({ id: "p3", ordinal: 3, status: "skipped" }),
    ];
    render(
      <DefeatStage
        runId="run_d2"
        directive="..."
        xpDelta={null}
        phases={phases}
      />,
    );

    // The failed phase title surfaces in the meta row ("failed at <title>")
    expect(
      screen.getAllByText(/Patch · serialize callers/).length,
    ).toBeGreaterThan(0);
  });

  it("renders honest empty state when no failed checks and no failed phase", () => {
    render(<DefeatStage runId="run_d3" directive="abort" xpDelta={0} />);
    expect(screen.getByText(/no failed checks reported/i)).toBeDefined();
  });
});
