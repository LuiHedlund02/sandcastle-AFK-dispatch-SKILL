import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ParsedPhase } from "@sandcastle/protocol";
import { PhaseEditorList } from "../../src/index.js";

afterEach(() => {
  cleanup();
});

function p(idx: number, title = `Phase ${idx}`): ParsedPhase {
  return {
    id: `p_${idx}`,
    ordinal: idx,
    title,
    directiveSlice: title,
    objective: `verify ${title}`,
    xpEstimate: 50,
    verifyRules: [],
  };
}

describe("PhaseEditorList", () => {
  it("renders N cards from phases prop", () => {
    render(<PhaseEditorList phases={[p(1), p(2), p(3)]} onChange={() => {}} />);
    expect(screen.getByLabelText("Phase 1: Phase 1")).toBeDefined();
    expect(screen.getByLabelText("Phase 2: Phase 2")).toBeDefined();
    expect(screen.getByLabelText("Phase 3: Phase 3")).toBeDefined();
  });

  it("renders empty hint when phases is empty", () => {
    render(<PhaseEditorList phases={[]} onChange={() => {}} />);
    expect(screen.getByText(/No phases yet/i)).toBeDefined();
  });

  it("move-up swaps two phases and renumbers ordinals", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorList
        phases={[p(1, "first"), p(2, "second"), p(3, "third")]}
        onChange={onChange}
      />,
    );
    const upBtn = screen.getByLabelText("Move phase 2 up");
    fireEvent.click(upBtn);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as ParsedPhase[];
    expect(next.map((x) => x.title)).toEqual(["second", "first", "third"]);
    expect(next.map((x) => x.ordinal)).toEqual([1, 2, 3]);
    expect(next.map((x) => x.id)).toEqual(["p_2", "p_1", "p_3"]);
  });

  it("move-down swaps two phases and renumbers ordinals", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorList
        phases={[p(1, "a"), p(2, "b"), p(3, "c")]}
        onChange={onChange}
      />,
    );
    const downBtn = screen.getByLabelText("Move phase 2 down");
    fireEvent.click(downBtn);
    const next = onChange.mock.calls[0]![0] as ParsedPhase[];
    expect(next.map((x) => x.title)).toEqual(["a", "c", "b"]);
    expect(next.map((x) => x.ordinal)).toEqual([1, 2, 3]);
  });

  it("delete removes a phase and renumbers", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorList
        phases={[p(1, "a"), p(2, "b"), p(3, "c")]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Delete phase 1"));
    const next = onChange.mock.calls[0]![0] as ParsedPhase[];
    expect(next.map((x) => x.title)).toEqual(["b", "c"]);
    expect(next.map((x) => x.ordinal)).toEqual([1, 2]);
  });

  it("disables move-up on first card and move-down on last card", () => {
    render(
      <PhaseEditorList phases={[p(1, "a"), p(2, "b")]} onChange={() => {}} />,
    );
    expect(
      (screen.getByLabelText("Move phase 1 up") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Move phase 2 down") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Move phase 1 down") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Move phase 2 up") as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
