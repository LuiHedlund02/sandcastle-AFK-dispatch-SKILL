import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OctaPanel } from "../src/index.js";

describe("OctaPanel", () => {
  it("renders eyebrow, header, body, and footer slots", () => {
    render(
      <OctaPanel
        eyebrow={<span>EYE</span>}
        header={<h2>HEAD</h2>}
        footer={<button>FOOT</button>}
      >
        <p>BODY</p>
      </OctaPanel>,
    );
    expect(screen.getByText("EYE")).toBeDefined();
    expect(screen.getByRole("heading", { name: "HEAD" })).toBeDefined();
    expect(screen.getByText("BODY")).toBeDefined();
    expect(screen.getByRole("button", { name: "FOOT" })).toBeDefined();
  });

  it("renders without optional slots", () => {
    render(<OctaPanel aria-label="bare">just body</OctaPanel>);
    expect(screen.getByLabelText("bare")).toBeDefined();
    expect(screen.getByText("just body")).toBeDefined();
  });

  it("respects tone + size props", () => {
    const { container } = render(
      <OctaPanel tone="magenta" size="sm">
        ...
      </OctaPanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("tone-magenta");
    expect(root.className).toContain("size-sm");
  });
});
