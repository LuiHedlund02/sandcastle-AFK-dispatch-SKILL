import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Phase, Run } from "@sandcastle/protocol";
import { CombatHud } from "../../src/index.js";
import { makeRun } from "../fixtures.js";

afterEach(() => {
  cleanup();
});

function makePhase(o: Partial<Phase> = {}): Phase {
  return {
    id: "p1",
    runId: "r1",
    ordinal: 1,
    title: "do thing",
    directiveSlice: "do thing",
    objective: "verify",
    xpEstimate: 50,
    verifyRules: [],
    status: "pending",
    startedAt: null,
    endedAt: null,
    ...o,
  };
}

describe("CombatHud", () => {
  it("renders 0% phases verified bar when no phases verified", () => {
    const run = makeRun({ status: "casting" });
    const phases: Phase[] = [
      makePhase({ id: "a", ordinal: 1 }),
      makePhase({ id: "b", ordinal: 2 }),
      makePhase({ id: "c", ordinal: 3 }),
    ];
    render(<CombatHud run={run} phases={phases} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("0/3")).toBeDefined();
    expect(screen.getByLabelText(/Run outcome: Pending/)).toBeDefined();
  });

  it("renders 100% bar + Victory callout when 3/3 phases verified and run.status=victory", () => {
    const run: Run = makeRun({ status: "victory" });
    const phases: Phase[] = [
      makePhase({ id: "a", ordinal: 1, status: "verified" }),
      makePhase({ id: "b", ordinal: 2, status: "verified" }),
      makePhase({ id: "c", ordinal: 3, status: "verified" }),
    ];
    render(<CombatHud run={run} phases={phases} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("3/3")).toBeDefined();
    const victory = screen.getByLabelText(/Run outcome: Victory/);
    expect(victory).toBeDefined();
    expect(victory.getAttribute("data-callout")).toBe("victory");
  });

  it("renders Win pending callout for win-pending status", () => {
    const run: Run = makeRun({ status: "win-pending" });
    const phases: Phase[] = [
      makePhase({ id: "a", ordinal: 1, status: "verified" }),
      makePhase({ id: "b", ordinal: 2, status: "verified" }),
      makePhase({ id: "c", ordinal: 3, status: "verified" }),
    ];
    render(<CombatHud run={run} phases={phases} />);
    expect(screen.getByLabelText(/Run outcome: Win pending/)).toBeDefined();
  });

  it("renders Defeat callout with failed-checks subline when run.status=defeat", () => {
    const run: Run = makeRun({
      status: "defeat",
      verification: { allGreen: false, failedChecks: ["tests", "lint"] },
    });
    render(<CombatHud run={run} phases={[]} />);
    const defeat = screen.getByLabelText(/Run outcome: Defeat/);
    expect(defeat).toBeDefined();
    expect(defeat.textContent ?? "").toMatch(/tests, lint/);
  });

  it("derives verify entries from phases when verifyEntries is omitted", () => {
    const run = makeRun({ status: "casting" });
    const phases: Phase[] = [
      makePhase({
        id: "a",
        ordinal: 1,
        status: "verified",
        verifyRules: [{ kind: "command", command: "npm test" }],
      }),
      makePhase({
        id: "b",
        ordinal: 2,
        status: "pending",
        verifyRules: [{ kind: "tests" }],
      }),
    ];
    render(<CombatHud run={run} phases={phases} />);
    expect(screen.getByText("command: npm test")).toBeDefined();
    expect(screen.getByText("tests: all")).toBeDefined();
  });
});
