import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandCardView, ModeCardView, SkillCardView } from "../src/index.js";
import { makeCommand, makeMode, makeSkill } from "./fixtures.js";

describe("Card views", () => {
  it("renders a Mode card", () => {
    render(<ModeCardView card={makeMode({ title: "MODE TITLE" })} />);
    expect(screen.getByLabelText("Mode card MODE TITLE")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
  });

  it("renders a Skill card", () => {
    render(<SkillCardView card={makeSkill({ title: "SKILL TITLE" })} />);
    expect(screen.getByLabelText("Skill card SKILL TITLE")).toBeDefined();
    expect(screen.getByText(/after edit/)).toBeDefined();
  });

  it("renders a Command card with its slash command in the meta slot", () => {
    render(<CommandCardView card={makeCommand({ slashCommand: "/zap" })} />);
    expect(screen.getByText("/zap")).toBeDefined();
  });
});
