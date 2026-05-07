import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MergeAllGreenButton } from "../src/index.js";

afterEach(() => {
  cleanup();
});

describe("MergeAllGreenButton", () => {
  it("is disabled when enabled=false", () => {
    const onClick = vi.fn();
    render(<MergeAllGreenButton enabled={false} onClick={onClick} />);
    const button = screen.getByRole("button", {
      name: /merge all green/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when enabled and clicked", () => {
    const onClick = vi.fn();
    render(<MergeAllGreenButton enabled={true} onClick={onClick} />);
    const button = screen.getByRole("button", { name: /merge all green/i });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("flashes a result summary when result.ok > 0", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <MergeAllGreenButton enabled={true} onClick={onClick} result={null} />,
    );
    expect(
      screen.getByRole("button", { name: /merge all green/i }),
    ).toBeDefined();

    rerender(
      <MergeAllGreenButton
        enabled={true}
        onClick={onClick}
        result={{ ok: 3, failed: 0, aborted: false }}
      />,
    );

    // Find the button by its current label (post-result) — it should show
    // a count summary while flashing.
    const flashed = screen.getByRole("button");
    expect(flashed.textContent).toContain("3 ok");
    expect(flashed.dataset.flashing).toBe("true");
  });

  it("flashes a mixed-result summary including failures", () => {
    const onClick = vi.fn();
    render(
      <MergeAllGreenButton
        enabled={true}
        onClick={onClick}
        result={{ ok: 1, failed: 2, aborted: false }}
      />,
    );
    const button = screen.getByRole("button");
    expect(button.textContent).toContain("1 ok");
    expect(button.textContent).toContain("2 failed");
  });

  it("shows 'Merging' label while pending", () => {
    render(
      <MergeAllGreenButton enabled={true} onClick={() => {}} pending={true} />,
    );
    expect(screen.getByRole("button", { name: /merging/i })).toBeDefined();
  });
});
