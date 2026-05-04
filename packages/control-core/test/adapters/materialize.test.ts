import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  InvalidProviderPathError,
  cleanupProviderPaths,
  materializeProviderFiles,
} from "../../src/adapters/materialize.js";

describe("provider materialization helpers", () => {
  it("writes files atomically with mkdir-p and cleanup removes them", async () => {
    const root = mkdtempSync(join(tmpdir(), "sandcastle-adapter-"));
    try {
      await materializeProviderFiles(root, {
        files: [
          {
            relativePath: ".claude/skills/test.md",
            content: "skill body",
          },
        ],
      });

      expect(
        readFileSync(join(root, ".claude", "skills", "test.md"), "utf8"),
      ).toBe("skill body");

      await cleanupProviderPaths(root, [".claude/"]);

      expect(existsSync(join(root, ".claude"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses absolute paths", async () => {
    await expect(
      materializeProviderFiles(
        mkdtempSync(join(tmpdir(), "sandcastle-adapter-")),
        {
          files: [{ relativePath: "/tmp/outside.md", content: "bad" }],
        },
      ),
    ).rejects.toThrow(InvalidProviderPathError);
  });

  it("refuses parent traversal paths", async () => {
    await expect(
      materializeProviderFiles(
        mkdtempSync(join(tmpdir(), "sandcastle-adapter-")),
        {
          files: [{ relativePath: "../outside.md", content: "bad" }],
        },
      ),
    ).rejects.toThrow(InvalidProviderPathError);
  });
});
