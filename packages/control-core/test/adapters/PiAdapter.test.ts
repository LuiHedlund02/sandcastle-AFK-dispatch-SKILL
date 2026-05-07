import { describe, expect, it } from "vitest";
import { PiAdapter } from "../../src/adapters/PiAdapter.js";
import { fixtureInput, runConformance } from "./conformance.js";

const adapter = new PiAdapter();

runConformance(adapter);

describe("PiAdapter", () => {
  it("matches the Pi materialization shape", async () => {
    await expect(adapter.materialize(fixtureInput("pi"))).resolves
      .toMatchInlineSnapshot(`
      {
        "cleanupPaths": [
          ".pi/",
        ],
        "files": [
          {
            "content": "{
        "mode": {
          "slug": "build",
          "title": "Build Mode",
          "body": "Build the requested change with focused tests."
        },
        "skills": [
          {
            "slug": "scope",
            "title": "Scope Keeper",
            "body": "Avoid unrelated refactors."
          },
          {
            "slug": "tests",
            "title": "Test Reader",
            "body": "Inspect nearby tests before adding coverage."
          }
        ],
        "commands": [
          {
            "slug": "summarize",
            "title": "Summarize",
            "body": "Summarize files changed and verification."
          },
          {
            "slug": "verify",
            "title": "Verify",
            "body": "Run the relevant test command and report the result."
          }
        ]
      }
      ",
            "relativePath": ".pi/registry.json",
          },
          {
            "content": "Build the requested change with focused tests.
      ",
            "relativePath": ".pi/prompt.md",
          },
        ],
      }
    `);
  });
});
