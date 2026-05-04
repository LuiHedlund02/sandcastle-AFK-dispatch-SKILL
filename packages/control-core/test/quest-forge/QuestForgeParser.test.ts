import { describe, expect, it } from "vitest";
import { QuestForgeParser } from "../../src/quest-forge/QuestForgeParser.js";

const parser = new QuestForgeParser();

describe("QuestForgeParser", () => {
  const fixtures: Array<{
    readonly name: string;
    readonly input: string;
    readonly titles: readonly string[];
  }> = [
    { name: "single sentence", input: "fix the bug", titles: ["fix the bug"] },
    {
      name: "imperative sentence sequence",
      input: "Add X. Refactor Y. Test Z.",
      titles: ["Add X.", "Refactor Y.", "Test Z."],
    },
    {
      name: "numbered dot list on one line",
      input: "1. Read. 2. Write. 3. Test.",
      titles: ["Read.", "Write.", "Test."],
    },
    {
      name: "numbered paren list",
      input: "1) Diagnose auth. 2) Patch auth.",
      titles: ["Diagnose auth.", "Patch auth."],
    },
    {
      name: "step list",
      input: "Step 1: Reproduce failure. Step 2: Fix failure.",
      titles: ["Reproduce failure.", "Fix failure."],
    },
    {
      name: "blank-line blocks",
      input: "Add parser.\n\nBuild route.",
      titles: ["Add parser.", "Build route."],
    },
    {
      name: "newline imperative starts",
      input: "Add parser.\nRefactor route.",
      titles: ["Add parser.", "Refactor route."],
    },
    {
      name: "mixed casing",
      input: "implement core. UPDATE tests.",
      titles: ["implement core.", "UPDATE tests."],
    },
    {
      name: "unicode preserved",
      input: "Add café support ☕. Fix naïve parser.",
      titles: ["Add café support ☕.", "Fix naïve parser."],
    },
    {
      name: "trailing punctuation",
      input: "Verify release!!!",
      titles: ["Verify release!!!"],
    },
    {
      name: "non-verb second sentence stays together",
      input: "Add parser. Then wire route.",
      titles: ["Add parser. Then wire route."],
    },
    {
      name: "remove and delete verbs",
      input: "Remove old flag. Delete dead file.",
      titles: ["Remove old flag.", "Delete dead file."],
    },
    {
      name: "rename and move verbs",
      input: "Rename module. Move tests.",
      titles: ["Rename module.", "Move tests."],
    },
    {
      name: "extract and introduce verbs",
      input: "Extract helper. Introduce route.",
      titles: ["Extract helper.", "Introduce route."],
    },
    {
      name: "reorganize and migrate verbs",
      input: "Reorganize folders. Migrate schema.",
      titles: ["Reorganize folders.", "Migrate schema."],
    },
    {
      name: "patch and commit verbs",
      input: "Patch bug. Commit result.",
      titles: ["Patch bug.", "Commit result."],
    },
    {
      name: "question boundary with verb",
      input: "Diagnose why it fails? Fix the root cause.",
      titles: ["Diagnose why it fails?", "Fix the root cause."],
    },
    {
      name: "exclamation boundary with verb",
      input: "Reproduce it! Document the finding.",
      titles: ["Reproduce it!", "Document the finding."],
    },
    {
      name: "long title truncates",
      input:
        "Add a very long parser title that should be truncated because it exceeds sixty characters.",
      titles: ["Add a very long parser title that should be truncated bec..."],
    },
    {
      name: "build refactor test extraction shape",
      input: "Build the app. Refactor assets. Test everything.",
      titles: ["Build the app.", "Refactor assets.", "Test everything."],
    },
  ];

  it.each(fixtures)("splits $name", ({ input, titles }) => {
    const phases = parser.parse(input);
    expect(phases.map((phase) => phase.title)).toEqual(titles);
    expect(phases.map((phase) => phase.ordinal)).toEqual(
      phases.map((_phase, index) => index + 1),
    );
    expect(phases.every((phase) => phase.title.length <= 60)).toBe(true);
  });

  it("returns no phases for empty or whitespace-only directives", () => {
    expect(parser.parse("")).toEqual([]);
    expect(parser.parse(" \n\t ")).toEqual([]);
  });

  it("extracts conservative verify rules", () => {
    expect(parser.parse("Test the parser")[0]?.verifyRules).toEqual([
      { kind: "tests", pattern: "all" },
    ]);
    expect(parser.parse("Build and typecheck")[0]?.verifyRules).toEqual([
      { kind: "command", command: "npm run build" },
      { kind: "command", command: "npm run typecheck" },
    ]);
  });

  it("caps per-phase xp at 250", () => {
    const phase = parser.parse(
      "Add one. Fix two. Test three. Build four. Update five. Remove six. Move seven. Rename eight. Delete nine.",
    )[0];
    expect(phase?.xpEstimate).toBeLessThanOrEqual(250);
  });
});
