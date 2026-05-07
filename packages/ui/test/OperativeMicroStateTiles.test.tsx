import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(() => cleanup());
import type { OperativeIdentity } from "@sandcastle/protocol";
import {
  FleetDock,
  FleetDockCell,
  ReactiveOperativeTile,
} from "../src/index.js";
import { makeRun } from "./fixtures.js";

const makeOperative = (
  overrides: Partial<OperativeIdentity> = {},
): OperativeIdentity => ({
  id: "op_test",
  codename: "PI",
  provider: "claude-code",
  model: "sonnet",
  species: "synthoid",
  className: "scout",
  level: 3,
  globalXp: 0,
  bond: 0,
  streak: 0,
  concurrencyCap: 1,
  sleeveCardIds: [],
  unlockedTraits: [],
  ...overrides,
});

describe("ReactiveOperativeTile data-state", () => {
  it("renders data-state='idle' by default", () => {
    render(<ReactiveOperativeTile operative={makeOperative()} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-state")).toBe("idle");
  });

  it.each(["casting", "striking", "crit", "hit"] as const)(
    "renders data-state='%s' when supplied",
    (state) => {
      render(
        <ReactiveOperativeTile
          operative={makeOperative()}
          microState={state}
        />,
      );
      const button = screen.getByRole("button");
      expect(button.getAttribute("data-state")).toBe(state);
    },
  );
});

describe("FleetDockCell data-state", () => {
  it("renders data-state='idle' by default", () => {
    render(<FleetDockCell run={makeRun({ id: "run_1" })} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-state")).toBe("idle");
  });

  it("forwards a custom microState", () => {
    render(
      <FleetDockCell run={makeRun({ id: "run_1" })} microState="striking" />,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-state")).toBe("striking");
  });
});

describe("FleetDock microStateByRunId", () => {
  it("threads per-run state to each cell", () => {
    render(
      <FleetDock
        runs={[
          makeRun({ id: "run_a", directive: "alpha" }),
          makeRun({ id: "run_b", directive: "beta" }),
        ]}
        capacity={{ used: 2, max: 5 }}
        onDeploy={() => {}}
        microStateByRunId={{ run_a: "casting", run_b: "hit" }}
      />,
    );
    const a = screen.getByLabelText(/Run run_a/);
    const b = screen.getByLabelText(/Run run_b/);
    expect(a.getAttribute("data-state")).toBe("casting");
    expect(b.getAttribute("data-state")).toBe("hit");
  });
});
