import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ActivityFeed } from "../../src/index.js";
import type { ActivityEvent } from "@sandcastle/protocol";

afterEach(() => {
  cleanup();
});

const NOW = new Date("2026-05-04T12:00:00Z").getTime();

function makeEvent(
  type: ActivityEvent["type"],
  overrides: Record<string, unknown> = {},
): ActivityEvent {
  const base = {
    id: `evt_${type}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date(NOW - 60_000).toISOString(),
    runId: "run_a",
    planetId: "planet_a",
    operativeId: "op_a",
  } as const;
  switch (type) {
    case "run.started":
      return {
        ...base,
        type,
        payload: { directive: "fix the flaky test" },
        ...overrides,
      } as ActivityEvent;
    case "run.status-changed":
      return {
        ...base,
        type,
        payload: { from: "casting", to: "verifying" },
        ...overrides,
      } as ActivityEvent;
    case "phase.updated":
      return {
        ...base,
        type,
        payload: { phaseId: "phase_1", status: "verified" },
        ...overrides,
      } as ActivityEvent;
    case "tool.called":
      return {
        ...base,
        type,
        payload: { name: "edit", formattedArgs: "src/foo.ts" },
        ...overrides,
      } as ActivityEvent;
    case "intervention.used":
      return {
        ...base,
        type,
        payload: { action: "skip-phase" },
        ...overrides,
      } as ActivityEvent;
    case "run.resolved":
      return {
        ...base,
        type,
        payload: { result: "victory", xpDelta: 525 },
        ...overrides,
      } as ActivityEvent;
  }
}

describe("ActivityFeed", () => {
  it("renders one item per event with the right type label", () => {
    const events: ActivityEvent[] = [
      makeEvent("run.started"),
      makeEvent("tool.called"),
      makeEvent("phase.updated"),
      makeEvent("run.resolved"),
    ];
    render(<ActivityFeed events={events} now={NOW} />);

    const list = screen.getByRole("list", { name: /activity feed/i });
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(4);
    expect(items[0]?.dataset.eventType).toBe("run.started");
    expect(items[1]?.dataset.eventType).toBe("tool.called");
    expect(items[2]?.dataset.eventType).toBe("phase.updated");
    expect(items[3]?.dataset.eventType).toBe("run.resolved");
  });

  it("renders an XP badge on run.resolved entries", () => {
    const events: ActivityEvent[] = [
      makeEvent("run.resolved", {
        payload: { result: "victory", xpDelta: 525 },
      }),
    ];
    render(<ActivityFeed events={events} now={NOW} />);
    expect(screen.getByText(/\+\s*525\s*XP/)).toBeDefined();
  });

  it("renders an honest empty state when there are no events", () => {
    render(<ActivityFeed events={[]} />);
    expect(
      screen.getByRole("status", { name: /activity feed empty/i }),
    ).toBeDefined();
    expect(screen.getByText(/no activity yet/i)).toBeDefined();
  });

  it("respects the `limit` prop", () => {
    const events: ActivityEvent[] = Array.from({ length: 20 }, (_, i) =>
      makeEvent("tool.called", {
        id: `e${i}`,
        payload: { name: "tool" + i, formattedArgs: "x" },
      }),
    );
    render(<ActivityFeed events={events} limit={5} now={NOW} />);
    const list = screen.getByRole("list", { name: /activity feed/i });
    expect(within(list).getAllByRole("listitem").length).toBe(5);
  });
});
