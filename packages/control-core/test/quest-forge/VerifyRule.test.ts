import { describe, expect, it } from "vitest";
import { zVerifyRule } from "../../src/quest-forge/VerifyRule.js";

describe("VerifyRule schema", () => {
  it("parses each valid kind", () => {
    expect(zVerifyRule.parse({ kind: "command", command: "npm test" })).toEqual(
      {
        kind: "command",
        command: "npm test",
      },
    );
    expect(zVerifyRule.parse({ kind: "tests", pattern: "parser" })).toEqual({
      kind: "tests",
      pattern: "parser",
    });
    expect(
      zVerifyRule.parse({ kind: "file", path: "README.md", mustExist: true }),
    ).toEqual({
      kind: "file",
      path: "README.md",
      mustExist: true,
    });
    expect(zVerifyRule.parse({ kind: "commits", minCount: 1 })).toEqual({
      kind: "commits",
      minCount: 1,
    });
  });

  it("rejects invalid cases", () => {
    expect(() => zVerifyRule.parse({ kind: "command", command: "" })).toThrow();
    expect(() => zVerifyRule.parse({ kind: "file", path: "" })).toThrow();
    expect(() =>
      zVerifyRule.parse({ kind: "commits", minCount: -1 }),
    ).toThrow();
    expect(() => zVerifyRule.parse({ kind: "unknown" })).toThrow();
  });
});
