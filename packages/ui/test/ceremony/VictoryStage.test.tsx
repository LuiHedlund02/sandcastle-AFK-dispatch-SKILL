import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { VictoryStage } from "../../src/index.js";
import { makePlanet } from "../fixtures.js";
import type { Phase } from "@sandcastle/protocol";

afterEach(() => {
  cleanup();
});

function makePhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "phase_1",
    runId: "run_v",
    ordinal: 1,
    title: "Reproduce the loop",
    directiveSlice: "phase 1",
    objective: "make the bug deterministic",
    xpEstimate: 50,
    verifyRules: [],
    status: "verified",
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(60_000).toISOString(),
    ...overrides,
  };
}

describe("VictoryStage", () => {
  it("renders the VICTORY headline, xp delta and merged-phases summary", () => {
    const phases: Phase[] = [
      makePhase({ id: "p1", ordinal: 1, status: "verified" }),
      makePhase({ id: "p2", ordinal: 2, status: "verified" }),
      makePhase({ id: "p3", ordinal: 3, status: "verified" }),
    ];

    render(
      <VictoryStage
        runId="run_v"
        directive="fix the flaky test"
        planet={makePlanet({ id: "planet_v" })}
        phases={phases}
        xpDelta={525}
        operativeCodename="PI · KAGE"
        operativeGlyph="π"
        mergeSha="0123456789abcdef"
        durationMs={680_000}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /VICTORY/i,
    );

    // Phase summary 3/3 — appears in both hero meta and phase log eyebrow
    expect(screen.getAllByText(/3\s*\/\s*3/).length).toBeGreaterThanOrEqual(1);

    // XP delta visible as +525 XP
    expect(screen.getByText(/\+\s*525\s*XP/)).toBeDefined();

    // Merged-phases list contains all three titles
    const list = screen.getByRole("list", { name: /merged phases/i });
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(3);
  });

  it("renders honest XP placeholder when xpDelta is null", () => {
    render(<VictoryStage runId="run_v2" directive="ship it" xpDelta={null} />);
    // honest placeholder, not "+0 XP"
    expect(screen.getByText(/—\s*XP/)).toBeDefined();
  });

  it("reduced-motion path renders a static confetti spray (no animation)", () => {
    const { container } = render(
      <VictoryStage
        runId="run_v3"
        directive="merge it"
        xpDelta={100}
        reducedMotion={true}
      />,
    );

    // Confetti pieces are spans with inline-style — when reducedMotion is
    // forced, animation:none is applied via inline style.
    const pieces = container.querySelectorAll<HTMLSpanElement>(
      'span[aria-hidden="true"]',
    );
    // At least the confetti pieces exist; locate one with animation:none.
    const animationNonePieces = Array.from(pieces).filter(
      (el) => el.style.animation === "none",
    );
    expect(animationNonePieces.length).toBeGreaterThan(0);
  });

  it("invokes onBackToFleet and onOpenCockpit when the buttons are clicked", () => {
    let backCount = 0;
    let cockpitCount = 0;
    render(
      <VictoryStage
        runId="run_v4"
        directive="merge it"
        xpDelta={100}
        onBackToFleet={() => {
          backCount += 1;
        }}
        onOpenCockpit={() => {
          cockpitCount += 1;
        }}
      />,
    );

    const back = screen.getByRole("button", { name: /back to fleet/i });
    const cockpit = screen.getByRole("button", { name: /open cockpit/i });
    back.click();
    cockpit.click();
    expect(backCount).toBe(1);
    expect(cockpitCount).toBe(1);
  });
});
