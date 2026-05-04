import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/adapters/ClaudeCodeAdapter.js";
import { fixtureInput, runConformance } from "./conformance.js";

const adapter = new ClaudeCodeAdapter();

runConformance(adapter);

describe("ClaudeCodeAdapter", () => {
  it("matches the Claude Code materialization shape", async () => {
    await expect(adapter.materialize(fixtureInput("claude-code"))).resolves
      .toMatchInlineSnapshot(`
      {
        "cleanupPaths": [
          ".claude/",
        ],
        "files": [
          {
            "content": "Operative: Builder Nyx
      Provider: claude-code
      Model: test-model

      # Build Mode

      Build the requested change with focused tests.",
            "relativePath": ".claude/agents.md",
          },
          {
            "content": "# Scope Keeper

      Avoid unrelated refactors.",
            "relativePath": ".claude/skills/scope.md",
          },
          {
            "content": "# Test Reader

      Inspect nearby tests before adding coverage.",
            "relativePath": ".claude/skills/tests.md",
          },
          {
            "content": "---
      description: "Summarize changes"
      argument-hint: "/summarize"
      ---

      # Summarize

      Summarize files changed and verification.",
            "relativePath": ".claude/commands/summarize.md",
          },
          {
            "content": "---
      description: "Run verification"
      argument-hint: "/verify"
      ---

      # Verify

      Run the relevant test command and report the result.",
            "relativePath": ".claude/commands/verify.md",
          },
        ],
      }
    `);
  });
});
