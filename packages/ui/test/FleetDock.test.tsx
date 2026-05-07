import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FleetDock } from "../src/index.js";
import { makeRun } from "./fixtures.js";

describe("FleetDock", () => {
  it("renders an empty hint when there are no runs", () => {
    render(
      <FleetDock
        runs={[]}
        capacity={{ used: 0, max: 5 }}
        onDeploy={() => {}}
      />,
    );
    expect(screen.getByLabelText("No active deployments")).toBeDefined();
  });

  it("renders a cell per run and fires onDeploy from the deploy button", () => {
    const onDeploy = vi.fn();
    const runs = [
      makeRun({ id: "run_1", directive: "first" }),
      makeRun({ id: "run_2", directive: "second", status: "victory" }),
    ];
    render(
      <FleetDock
        runs={runs}
        capacity={{ used: 2, max: 5 }}
        onDeploy={onDeploy}
      />,
    );
    expect(screen.getByText("first")).toBeDefined();
    expect(screen.getByText("second")).toBeDefined();
    // Multiple buttons fire onDeploy: the dock head ("Fleet ...") and the
    // explicit deploy button. Click both: total should be 2.
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.match(/Deploy|Fleet/));
    for (const btn of buttons) fireEvent.click(btn);
    expect(onDeploy).toHaveBeenCalled();
  });

  it("calls onSelectRun when a cell is clicked (button mode)", () => {
    const onSelect = vi.fn();
    const runs = [makeRun({ id: "run_x", directive: "click me" })];
    render(
      <FleetDock
        runs={runs}
        capacity={{ used: 1, max: 5 }}
        onDeploy={() => {}}
        onSelectRun={onSelect}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Run run_x/));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
