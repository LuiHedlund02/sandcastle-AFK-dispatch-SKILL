/**
 * Per-worker git config isolation for control-core integration tests.
 *
 * Phase 2 introduces tests that exercise multiple parallel runs against
 * real `git init` repos. The engine's SandboxLifecycle writes to
 * `git config --global` to propagate the host user.name/user.email into
 * the sandbox; concurrent writes race on `.gitconfig.lock` and produce
 * intermittent "could not lock config file" failures on Windows.
 *
 * Mirrors `src/testSetup.ts` from the engine. Each vitest worker gets its
 * own GIT_CONFIG_GLOBAL file.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "sandcastle-control-gitconfig-"));
const globalConfigPath = join(tmpDir, ".gitconfig");
writeFileSync(globalConfigPath, "");
process.env.GIT_CONFIG_GLOBAL = globalConfigPath;

process.on("exit", () => {
  try {
    rmSync(tmpDir, { recursive: true });
  } catch {
    // best-effort cleanup
  }
});
