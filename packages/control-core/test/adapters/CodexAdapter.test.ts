import { describe, expect, it } from "vitest";
import { CodexAdapter } from "../../src/adapters/CodexAdapter.js";
import { fixtureInput, runConformance } from "./conformance.js";

const adapter = new CodexAdapter();

runConformance(adapter);

describe("CodexAdapter", () => {
  it("matches the Codex materialization shape", async () => {
    await expect(adapter.materialize(fixtureInput("codex"))).resolves
      .toMatchInlineSnapshot(`
      {
        "cleanupPaths": [
          "AGENTS.md",
        ],
        "files": [
          {
            "content": "Operative: Builder Nyx
      Provider: codex
      Model: test-model



      ## Mode: Build Mode

      Build the requested change with focused tests.

      ## Skill: Scope Keeper

      Avoid unrelated refactors.

      ## Skill: Test Reader

      Inspect nearby tests before adding coverage.

      ## Command: /summarize Summarize

      Summarize files changed and verification.

      ## Command: /verify Verify

      Run the relevant test command and report the result.",
            "relativePath": "AGENTS.md",
          },
        ],
      }
    `);
  });
});
