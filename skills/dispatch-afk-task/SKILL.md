---
name: dispatch-afk-task
description: Dispatch AFK coding tasks through Sandcastle using Pi with an OpenAI Codex subscription. Use when Codex should hand off a longer coding task to a sandboxed Sandcastle run, monitor logs, inspect branches, and review diffs before merge.
---

# Dispatch AFK Task

Use Sandcastle when a coding task is long-running, parallelizable, or benefits from an isolated worktree/branch.

## Preconditions

- Verify the target repo is a git repo and its working tree is clean before dispatching editable work.
- Prefer `sandcastle init --agent pi-codex --model openai-codex/gpt-5.5` for subscription-backed Codex work.
- Ensure the user has run `pi /login` on the host and selected the OpenAI/Codex provider.
- Treat the generated `~/.pi/agent` mount as sensitive: it gives the sandbox access to Pi OAuth tokens.
- If `sandcastle` is not on PATH, use the local checkout at `C:\Users\miyam\dev\sandcastle tool` with `node "C:\Users\miyam\dev\sandcastle tool\dist\main.js"` after confirming it has been built.

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
4. Put the task in the relevant `.sandcastle/*.md` prompt or pass a focused inline prompt through the existing script.
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
- If the run fails, inspect the log tail before retrying or changing prompts.

## Review Before Merge

- Inspect generated branches with `git log --oneline --decorate --graph --all`.
- Review changes with `git diff <target-branch>...<agent-branch>`.
- Run the repo's tests/typecheck before merging.
- Do not merge or delete preserved worktrees until the diff is reviewed.
