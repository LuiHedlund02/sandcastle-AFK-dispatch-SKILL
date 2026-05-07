import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// Blank template: customize this to build your own orchestration.
// Run this with: npx tsx .sandcastle/main.mts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.mts"

await run({
  agent: claudeCode("claude-opus-4-6"),
  sandbox: docker(),
  // AFK runs should land on a review branch instead of writing directly to
  // the current checkout. Rename this branch for each task.
  branchStrategy: { type: "branch", branch: "codex/sandcastle-afk-task" },
  promptFile: "./.sandcastle/prompt.md",
});
