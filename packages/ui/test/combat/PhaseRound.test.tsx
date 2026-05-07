import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Phase } from "@sandcastle/protocol";
import { PhaseRound } from "../../src/index.js";

afterEach(() => {
  cleanup();
});

function makePhase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: "phase_1",
    runId: "run_1",
    ordinal: 1,
    title: "Reproduce flake",
    directiveSlice: "Reproduce the failing test",
    objective: "verify reproduce",
    xpEstimate: 75,
    verifyRules: [],
    status: "pending",
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

describe("PhaseRound", () => {
  it("renders title + ordinal + objective", () => {
    render(<PhaseRound phase={makePhase()} />);
    expect(screen.getByText("Reproduce flake")).toBeDefined();
    expect(screen.getByText("Round 1")).toBeDefined();
    expect(screen.getByText("verify reproduce")).toBeDefined();
  });

  it("renders distinct status visuals via aria-label and data-status", () => {
    const states: Array<{
      status: Phase["status"];
      label: RegExp;
      attr: string;
    }> = [
      { status: "pending", label: /Idle/, attr: "pending" },
      { status: "active", label: /Engaged/, attr: "active" },
      { status: "verified", label: /Held/, attr: "verified" },
      { status: "failed", label: /Broken/, attr: "failed" },
    ];

    for (const s of states) {
      cleanup();
      const { container } = render(
        <PhaseRound phase={makePhase({ status: s.status })} />,
      );
      const root = container.querySelector("article")!;
      expect(root.getAttribute("data-status")).toBe(s.attr);
      expect(root.getAttribute("aria-label") ?? "").toMatch(s.label);
    }
  });

  it("treats active+verifyResults as verifying", () => {
    const { container } = render(
      <PhaseRound
        phase={makePhase({ status: "active" })}
        verifyResults={[
          {
            rule: { kind: "tests" },
            ok: true,
            durationMs: 100,
          },
        ]}
      />,
    );
    const root = container.querySelector("article")!;
    expect(root.getAttribute("data-status")).toBe("verifying");
    expect(root.getAttribute("aria-label") ?? "").toMatch(/Verifying/);
  });

  it("renders attack rolls from paired tool events", () => {
    const ts = new Date(0);
    render(
      <PhaseRound
        phase={makePhase({ status: "active" })}
        toolEvents={[
          {
            type: "tool.started",
            iteration: 1,
            timestamp: ts,
            name: "Bash",
            formattedArgs: "npm test",
            toolCallId: "t1",
          },
          {
            type: "tool.finished",
            iteration: 1,
            timestamp: ts,
            name: "Bash",
            toolCallId: "t1",
            durationMs: 1234,
            ok: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("ATTACK · Bash")).toBeDefined();
    expect(screen.getByText("npm test")).toBeDefined();
  });

  it("renders saving throws from verify results", () => {
    render(
      <PhaseRound
        phase={makePhase({ status: "verified" })}
        verifyResults={[
          {
            rule: { kind: "command", command: "npm test" },
            ok: true,
            durationMs: 500,
          },
          {
            rule: { kind: "tests", pattern: "api" },
            ok: false,
            durationMs: 300,
          },
        ]}
      />,
    );
    expect(screen.getByText("command: npm test")).toBeDefined();
    expect(screen.getByText("tests: api")).toBeDefined();
    expect(screen.getByLabelText(/command: npm test — Pass/)).toBeDefined();
    expect(screen.getByLabelText(/tests: api — Fail/)).toBeDefined();
  });
});
