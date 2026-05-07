import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeployChordOverlay } from "../src/index.js";

describe("DeployChordOverlay", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <DeployChordOverlay
        open={false}
        onOpenChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("submits trimmed directive and is gated on empty input", () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DeployChordOverlay
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );
    const textarea = screen.getByLabelText("Directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.submit(textarea.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: "  fix bug  " } });
    fireEvent.submit(textarea.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith({ directive: "fix bug" });
  });

  it("closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <DeployChordOverlay
        open
        onOpenChange={onOpenChange}
        onSubmit={() => {}}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("surfaces an error message when provided", () => {
    render(
      <DeployChordOverlay
        open
        onOpenChange={() => {}}
        onSubmit={() => {}}
        error="server said no"
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("server said no");
  });
});
