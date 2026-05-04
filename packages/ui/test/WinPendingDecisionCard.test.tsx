import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WinPendingDecisionCard } from "../src/index.js";
import { makeRun } from "./fixtures.js";

afterEach(() => {
  cleanup();
});

describe("WinPendingDecisionCard", () => {
  it("renders three buttons for win-pending and fires onDecide for each", () => {
    const onDecide = vi.fn();
    const run = makeRun({ status: "win-pending", id: "run_w" });
    render(<WinPendingDecisionCard run={run} onDecide={onDecide} />);

    const merge = screen.getByRole("button", { name: /merge/i });
    const revise = screen.getByRole("button", { name: /revise/i });
    const discard = screen.getByRole("button", { name: /discard/i });

    fireEvent.click(merge);
    expect(onDecide).toHaveBeenLastCalledWith("merge");
    fireEvent.click(revise);
    expect(onDecide).toHaveBeenLastCalledWith("revise");
    fireEvent.click(discard);
    expect(onDecide).toHaveBeenLastCalledWith("discard");
    expect(onDecide).toHaveBeenCalledTimes(3);
  });

  it("renders only two buttons for fail-pending (no merge)", () => {
    const onDecide = vi.fn();
    const run = makeRun({
      status: "fail-pending",
      verification: { allGreen: false, failedChecks: ["unit", "lint"] },
    });
    render(<WinPendingDecisionCard run={run} onDecide={onDecide} />);

    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
    expect(screen.getByRole("button", { name: /revise/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /discard/i })).toBeDefined();
    // Failed checks are surfaced for the user.
    expect(screen.getByText("unit")).toBeDefined();
    expect(screen.getByText("lint")).toBeDefined();
  });

  it("returns null for runs that are not in a pending decision state", () => {
    const onDecide = vi.fn();
    const run = makeRun({ status: "casting" });
    const { container } = render(
      <WinPendingDecisionCard run={run} onDecide={onDecide} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("disables every button when pending=true", () => {
    const onDecide = vi.fn();
    const run = makeRun({ status: "win-pending" });
    render(
      <WinPendingDecisionCard run={run} onDecide={onDecide} pending={true} />,
    );

    const merge = screen.getByRole("button", { name: /merge/i });
    const revise = screen.getByRole("button", { name: /revise/i });
    const discard = screen.getByRole("button", { name: /discard/i });
    expect((merge as HTMLButtonElement).disabled).toBe(true);
    expect((revise as HTMLButtonElement).disabled).toBe(true);
    expect((discard as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(merge);
    fireEvent.click(revise);
    fireEvent.click(discard);
    expect(onDecide).not.toHaveBeenCalled();
  });
});
