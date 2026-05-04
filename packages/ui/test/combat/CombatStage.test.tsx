import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CombatStage } from "../../src/index.js";

afterEach(() => {
  cleanup();
});

describe("CombatStage", () => {
  it("renders banner with operative + planet + run id + status", () => {
    render(
      <CombatStage
        runId="run_42"
        operativeName="Agent Pi"
        planetName="sandcastle"
        statusLabel="casting"
      >
        <div>round 1</div>
      </CombatStage>,
    );
    expect(screen.getByText("Agent Pi")).toBeDefined();
    expect(screen.getByText("sandcastle")).toBeDefined();
    expect(screen.getByText("run run_42")).toBeDefined();
    expect(screen.getByLabelText("Combat status: casting")).toBeDefined();
    expect(screen.getByText("round 1")).toBeDefined();
  });

  it("renders empty hint when no children", () => {
    render(
      <CombatStage
        runId="run_x"
        operativeName="X"
        planetName="P"
        statusLabel="queued"
      />,
    );
    expect(screen.getByText(/no phases yet/i)).toBeDefined();
  });

  it("renders the hud slot when provided", () => {
    render(
      <CombatStage
        runId="r"
        operativeName="o"
        planetName="p"
        statusLabel="queued"
        hud={<div>hud-mock</div>}
      />,
    );
    expect(screen.getByLabelText("Combat HUD")).toBeDefined();
    expect(screen.getByText("hud-mock")).toBeDefined();
  });

  // Reduced-motion: the stage doesn't animate, but its CSS module must not
  // attach any animation class in the rendered DOM. We assert that no
  // element on the page has an inline animation; the real safety net is
  // the @media (prefers-reduced-motion: reduce) rule in the children's
  // CSS, which jsdom can't evaluate. Here we simply confirm structure.
  it("does not attach animation classes to its root", () => {
    const { container } = render(
      <CombatStage
        runId="r"
        operativeName="o"
        planetName="p"
        statusLabel="queued"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();
    // No class on the stage itself should reference animation keywords;
    // animations live only on per-state child primitives.
    expect(root.className).not.toMatch(/anim|pulse|holo/);
  });
});
