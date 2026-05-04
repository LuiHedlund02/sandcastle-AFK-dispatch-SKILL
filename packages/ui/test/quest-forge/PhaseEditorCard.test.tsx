import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ParsedPhase } from "@sandcastle/protocol";
import {
  PhaseEditorCard,
  parseVerifyRuleString,
  describeVerifyRule,
} from "../../src/index.js";

afterEach(() => {
  cleanup();
});

function makePhase(o: Partial<ParsedPhase> = {}): ParsedPhase {
  return {
    id: "p_1",
    ordinal: 1,
    title: "do thing",
    directiveSlice: "do thing",
    objective: "verify",
    xpEstimate: 50,
    verifyRules: [],
    ...o,
  };
}

describe("PhaseEditorCard", () => {
  it("editing the title fires onChange with the title updated", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorCard
        phase={makePhase()}
        canMoveUp={false}
        canMoveDown={false}
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText("Phase 1 title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "renamed" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toMatchObject({ title: "renamed" });
  });

  it("editing the objective fires onChange", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorCard
        phase={makePhase()}
        canMoveUp={false}
        canMoveDown={false}
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText(
      "Phase 1 objective",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "verify exit 0" } });
    expect(onChange.mock.calls[0]![0]).toMatchObject({
      objective: "verify exit 0",
    });
  });

  it("typing 'command: npm test' and pressing Enter adds a verify rule", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorCard
        phase={makePhase()}
        canMoveUp={false}
        canMoveDown={false}
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText(
      "Add verify rule to phase 1",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "command: npm test" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toMatchObject({
      verifyRules: [{ kind: "command", command: "npm test" }],
    });
  });

  it("clicking Add with bad input shows an inline error and does not call onChange", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorCard
        phase={makePhase()}
        canMoveUp={false}
        canMoveDown={false}
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />,
    );
    const input = screen.getByLabelText(
      "Add verify rule to phase 1",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "garbage" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("removes a verify rule chip when × is clicked", () => {
    const onChange = vi.fn();
    render(
      <PhaseEditorCard
        phase={makePhase({
          verifyRules: [
            { kind: "command", command: "npm test" },
            { kind: "tests" },
          ],
        })}
        canMoveUp={false}
        canMoveDown={false}
        onChange={onChange}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByLabelText("Remove verify rule command: npm test"),
    );
    expect(onChange.mock.calls[0]![0]).toMatchObject({
      verifyRules: [{ kind: "tests" }],
    });
  });

  it("parseVerifyRuleString handles all kinds + invalid input", () => {
    expect(parseVerifyRuleString("command: npm test")).toEqual({
      kind: "command",
      command: "npm test",
    });
    expect(parseVerifyRuleString("tests: api")).toEqual({
      kind: "tests",
      pattern: "api",
    });
    expect(parseVerifyRuleString("tests:")).toEqual({ kind: "tests" });
    expect(parseVerifyRuleString("tests: all")).toEqual({ kind: "tests" });
    expect(parseVerifyRuleString("file: dist/main.js")).toEqual({
      kind: "file",
      path: "dist/main.js",
      mustExist: true,
    });
    expect(parseVerifyRuleString("file!: secret.env")).toEqual({
      kind: "file",
      path: "secret.env",
      mustExist: false,
    });
    expect(parseVerifyRuleString("commits: 3")).toEqual({
      kind: "commits",
      minCount: 3,
    });
    expect(parseVerifyRuleString("garbage")).toBeNull();
    expect(parseVerifyRuleString("unknown: x")).toBeNull();
    expect(parseVerifyRuleString("commits: -1")).toBeNull();
    expect(parseVerifyRuleString("command:")).toBeNull();
  });

  it("describeVerifyRule produces stable strings", () => {
    expect(
      describeVerifyRule({ kind: "command", command: "npm run build" }),
    ).toBe("command: npm run build");
    expect(describeVerifyRule({ kind: "tests" })).toBe("tests: all");
    expect(describeVerifyRule({ kind: "tests", pattern: "api" })).toBe(
      "tests: api",
    );
    expect(
      describeVerifyRule({ kind: "file", path: "dist/x", mustExist: true }),
    ).toBe("file: dist/x");
    expect(
      describeVerifyRule({ kind: "file", path: "x", mustExist: false }),
    ).toBe("file (gone): x");
    expect(describeVerifyRule({ kind: "commits", minCount: 1 })).toBe(
      "commits: 1",
    );
  });
});
