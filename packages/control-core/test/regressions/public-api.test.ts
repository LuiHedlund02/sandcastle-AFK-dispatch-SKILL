import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Public API surface pin for the published `@ai-hero/sandcastle` package.
 *
 * Phase 6 hard rule: extracting the transport layer must NOT change the
 * shape of the public CLI/library bundle. We assert the exact file count
 * `npm pack --dry-run` would produce. When this test fails, either:
 *
 *   1. you added something to `src/` that's intentional → bump the
 *      constant, ship a changeset, and document the new file in the PR.
 *   2. the count drifted accidentally → revert the change.
 *
 * The constant is exported so future shifts are explicit and reviewable.
 */
export const PUBLIC_API_FILE_COUNT = 222 as const;

const here = dirname(fileURLToPath(import.meta.url));
// repo root is four levels up: regressions → test → control-core → packages → repo
const repoRoot = resolve(here, "..", "..", "..", "..");

describe("public api regression", () => {
  it(`@ai-hero/sandcastle pack contains exactly ${PUBLIC_API_FILE_COUNT} files`, () => {
    let result: string;
    try {
      result = execFileSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["pack", "--dry-run", "--json"],
        {
          cwd: repoRoot,
          encoding: "utf8",
          // On Windows, .cmd shims must be invoked through the shell —
          // execFileSync fails with EINVAL otherwise.
          shell: process.platform === "win32",
          // npm pack writes some progress to stderr; that's fine.
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
    } catch (error) {
      // If the runtime sandbox can't run npm we surface the error so the
      // test fails loudly rather than silently passing — the dispatch
      // says we may `it.skip` if the sandbox is unable to run npm; here
      // we let the failure speak so CI catches infrastructure breakage.
      throw new Error(
        `Failed to run \`npm pack --dry-run --json\` from ${repoRoot}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const parsed = JSON.parse(result) as Array<{ entryCount: number }>;
    const first = parsed[0];
    expect(first, "npm pack --json returned no entries").toBeDefined();
    expect(first!.entryCount).toBe(PUBLIC_API_FILE_COUNT);
  }, 60_000);
});
