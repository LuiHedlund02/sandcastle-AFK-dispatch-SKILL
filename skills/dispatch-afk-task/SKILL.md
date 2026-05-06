---
name: dispatch-afk-task
description: Dispatch AFK coding tasks through Sandcastle using Pi with an OpenAI Codex subscription. Use when Codex should hand off a longer coding task to a sandboxed Sandcastle run, monitor logs, inspect branches, and review diffs before merge.
---

# Dispatch AFK Task

Use Sandcastle for durable AFK implementation. Keep foreground Codex as orchestrator: define scope, dispatch runs, monitor evidence, review diffs, and decide whether to iterate, split, merge, or abandon.

Use internal Codex sub-agents for bounded planning and review only. Do not treat them as durable implementers; use them to enrich specs, scout code, identify risks, or review Sandcastle output while Sandcastle owns long-running branch work.

## Preconditions

- Verify the target repo is a git repo and its working tree is clean before dispatching editable work.
- Prefer `sandcastle init --agent pi-codex --model openai-codex/gpt-5.5` for subscription-backed Codex work.
- Ensure the user has run `pi /login` on the host and selected the OpenAI/Codex provider.
- Treat the generated `~/.pi/agent` mount as sensitive: it gives the sandbox access to Pi OAuth tokens.
- If `sandcastle` is not on PATH, use the local checkout at `C:\Users\miyam\dev\sandcastle tool` with `node "C:\Users\miyam\dev\sandcastle tool\dist\main.js"` after confirming it has been built.
- On Windows, avoid deep OneDrive paths for large AFK work when possible. Prefer a short clone/workroot such as `C:\src\<repo>` or `C:\work\<repo>` to reduce long-path and cleanup failures.

## Shape The Work

- Write the task as an outcome, constraints, validation commands, and merge expectations.
- Choose one long Sandcastle plan when the work is cohesive and benefits from many implementation iterations on one branch.
- Choose branch slices when work can land independently. Run slices in parallel for isolated areas; run them sequentially when each slice depends on the previous diff.
- Ask internal sub-agents to scout or critique only when their output will materially improve the prompt or review checklist.

## Dispatch

1. Initialize Sandcastle when `.sandcastle/` is missing:

```bash
sandcastle init --agent pi-codex --model openai-codex/gpt-5.5 --sandbox-provider docker --backlog-manager beads --template blank --skip-build
```

2. Build the sandbox image:

```bash
sandcastle docker build-image
```

3. Inspect `.sandcastle/main.ts` or `.sandcastle/main.mts` and the prompt files.
4. Put the task in the relevant `.sandcastle/*.md` prompt or pass a focused inline prompt through the existing script. Include branch/slice names when running multiple branches.
5. Start the run with the repo's configured script, usually:

```bash
npm run sandcastle
```

If no script exists, use:

```bash
npx tsx .sandcastle/main.ts
```

or:

```bash
npx tsx .sandcastle/main.mts
```

## Monitor

- Follow logs under `.sandcastle/logs/`.
- Watch for the generated branch name and commit count in Sandcastle output.
- For long single-plan runs, expect multiple Sandcastle iterations; steer only with evidence from logs, commits, tests, or review diffs.
- For sliced work, track each branch independently and record which branches are parallel-safe, blocked, or ready for sequential handoff.
- If a run fails, inspect the log tail before retrying or changing prompts.

## Recover

- Recover state from logs, generated branches, and preserved worktrees before rerunning.
- Use `git branch --all`, `git worktree list`, and `git log --oneline --decorate --graph --all` to find surviving work.
- On Windows, treat cleanup errors in deep or OneDrive-backed paths as path-length or file-lock suspects. Move future runs to a short-path clone/workroot rather than deleting aggressively.
- Do not delete preserved worktrees, branches, or logs until useful diffs are reviewed or explicitly abandoned.

## Review Before Merge

- Review each generated branch with `git diff <target-branch>...<agent-branch>`.
- Use internal sub-agents for focused review when the diff is large, risky, or split across slices.
- Run the repo's tests/typecheck before merging.
- Merge sequential slices only after the previous slice is validated on its branch.
- Keep foreground Codex responsible for final integration decisions and user-facing summary.
