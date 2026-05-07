import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TelemetryGrid } from "../../src/index.js";
import type { RepoTelemetry } from "@sandcastle/protocol";

afterEach(() => {
  cleanup();
});

const allNull: RepoTelemetry = {
  coveragePct: null,
  ciGreenRate30d: null,
  openIssues: null,
  churnScore: null,
  ageDays: null,
  testCount: null,
  branch: null,
  lastCommitAt: null,
  lastIndexedAt: null,
};

describe("TelemetryGrid", () => {
  it("renders '—' for null fields rather than substituting 0", () => {
    const { container } = render(<TelemetryGrid telemetry={allNull} />);

    // Every dd cell with a null value should be marked data-no-signal="true"
    const noSignalCells = container.querySelectorAll<HTMLElement>(
      'dd[data-no-signal="true"]',
    );
    // 8 cells expected (branch falls back when fallbackBranch given; here it's null, so all 8 are null)
    expect(noSignalCells.length).toBe(8);
    noSignalCells.forEach((dd) => {
      expect(dd.textContent).toBe("—");
      expect(dd.title).toBe("no signal");
      // never the literal "0"
      expect(dd.textContent).not.toBe("0");
      expect(dd.textContent).not.toBe("0%");
    });
  });

  it("falls back to fallbackBranch when telemetry.branch is null", () => {
    render(<TelemetryGrid telemetry={allNull} fallbackBranch="main" />);
    expect(screen.getByText("main")).toBeDefined();
  });

  it("renders coverage as N% with one decimal when non-null (fraction input)", () => {
    const tel: RepoTelemetry = { ...allNull, coveragePct: 0.8423 };
    render(<TelemetryGrid telemetry={tel} />);
    expect(screen.getByText(/84\.2\s*%/)).toBeDefined();
  });

  it("renders coverage as N% with one decimal when non-null (percent input)", () => {
    const tel: RepoTelemetry = { ...allNull, coveragePct: 92.5 };
    render(<TelemetryGrid telemetry={tel} />);
    expect(screen.getByText(/92\.5\s*%/)).toBeDefined();
  });

  it("renders open issues / tests as readable numbers", () => {
    const tel: RepoTelemetry = {
      ...allNull,
      openIssues: 1234,
      testCount: 217,
    };
    render(<TelemetryGrid telemetry={tel} />);
    // Locale-tolerant: any thousand separator (or none)
    expect(screen.getByText(/^1[\s,. ]?234$/)).toBeDefined();
    expect(screen.getByText("217")).toBeDefined();
  });
});
