import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "../src/index.js";
import { allStatuses } from "./fixtures.js";

describe("StatusPill", () => {
  it("renders every RunStatus with a readable label", () => {
    for (const status of allStatuses) {
      const { unmount } = render(<StatusPill status={status} />);
      const expected = status.replace("-", " ");
      expect(
        screen.getByRole("status", { name: new RegExp(expected) }),
      ).toBeDefined();
      unmount();
    }
  });
});
