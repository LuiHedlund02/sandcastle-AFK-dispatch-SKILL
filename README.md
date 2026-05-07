# Sandcastle Codex Dispatch

Run long AI coding plans as durable, reviewable AFK work.

This fork of [mattpocock/sandcastle](https://github.com/mattpocock/sandcastle) is focused on one workflow: foreground Codex coordinates the work, Sandcastle creates the isolated branch/worktree/sandbox lifecycle, and Pi runs an OpenAI Codex subscription-backed coding agent inside that sandbox.

The goal is not to replace Codex subagents. Use subagents for fast scouting, decomposition, critique, and review. Use Sandcastle when the implementation itself needs to keep going after you step away.

## Why This Exists

When you give an AI agent a long implementation plan, the common failure mode is that it handles the first few steps and stops. This project makes the long-running part explicit:

- one AFK task gets one durable git branch, worktree, sandbox, log stream, and commit boundary
- `maxIterations` keeps a cohesive plan moving through multiple agent turns
- independent slices can still run on separate branches in parallel
- resulting branches are reviewed and merged by foreground Codex or a human
- Pi can use your local OpenAI Codex subscription login instead of an OpenAI API key

## Mental Model

```text
you
  -> foreground Codex
      -> Sandcastle
          -> git branch + worktree
          -> Docker/Podman sandbox
          -> Pi CLI
          -> OpenAI Codex subscription model
          -> logs + commits + reviewable diffs
```

Roles:

- **Foreground Codex** plans, dispatches, monitors logs, asks subagents for bounded help, reviews diffs, and decides what to merge.
- **Codex subagents** enrich the workflow with scoped scouting or review. They are useful, but they are not the durable implementation engine.
- **Sandcastle AFK jobs** own long-running implementation on real branches.
- **Pi** runs the subscription-backed coding agent.
- **Git** is the review and integration boundary.

## Prerequisites

- Git
- Node.js and npm
- Docker Desktop or Podman for local sandboxing
- [Pi CLI](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- A host Pi login:

```bash
pi /login
```

Select the OpenAI/Codex provider during login.

You can confirm model availability with:

```bash
pi --list-models openai
```

This workflow defaults to:

```text
openai-codex/gpt-5.5
```

On Windows, avoid deep OneDrive-backed paths for large AFK work. Prefer a short repo path such as `C:\src\my-repo` or configure a short `worktreeRoot`.

## Quick Start

Initialize Sandcastle in the repo you want Codex to work on:

```bash
npx sandcastle init --agent pi-codex --model openai-codex/gpt-5.5 --sandbox-provider docker
```

Build the sandbox image:

```bash
npx sandcastle docker build-image
```

Edit the generated prompt:

```text
.sandcastle/prompt.md
```

Run the generated script:

```bash
npx tsx .sandcastle/main.mts
```

The generated config uses the Pi provider:

```ts
import { run, pi } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

await run({
  agent: pi("openai-codex/gpt-5.5"),
  sandbox: docker(),
  promptFile: ".sandcastle/prompt.md",
  maxIterations: 5,
});
```

## Install The Codex Skill

This repo includes a Codex skill that teaches foreground Codex how to dispatch, monitor, recover, and review Sandcastle AFK work:

```text
skills/dispatch-afk-task/SKILL.md
```

Install it into Codex:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills\dispatch-afk-task"
Copy-Item ".\skills\dispatch-afk-task\SKILL.md" "$env:USERPROFILE\.codex\skills\dispatch-afk-task\SKILL.md" -Force
```

After installation, ask Codex to use `dispatch-afk-task` when a plan should be implemented AFK through Sandcastle.

## AFK Dispatch Workflow

1. Start from a clean git worktree.
2. Write the implementation request as an outcome, constraints, validation commands, and merge expectations.
3. Decide whether the work is one cohesive plan or multiple vertical slices.
4. Dispatch AFK implementation through Sandcastle.
5. Monitor `.sandcastle/logs`.
6. Inspect generated branches and worktrees.
7. Run validation commands.
8. Review diffs before merging.

Useful commands:

```bash
git status --short --branch
git branch --list "codex/*"
git worktree list
git log --oneline --decorate --graph --all --max-count=20
git diff main...codex/my-afk-task
```

## Vertical Slice Dispatch

A good AFK plan separates work into vertical slices:

```md
# Plan AFK vertical slices

Attachment rejection stays failed - AFK

Behavior: an attachment API response like `{ success: false, error: "..." }`
leaves the voucher in a retryable error state.
Acceptance: API wrapper throws a formatted error; queue/store tests prove the
voucher is not marked uploaded.
Parallelization: parallel-ready; owns API wrapper and attachment tests.
Validation: npm test -- --runTestsByPath **tests**/api/attachments.test.ts

Voucher sync single-flight guard - AFK

Behavior: concurrent startup/auto/manual sync calls result in one active upload loop.
Acceptance: concurrent syncQueue() calls with one pending voucher upload once.
Parallelization: parallel-ready if it owns only the store sync path.
Validation: targeted store tests plus full test suite.

Tenant-scoped persistence - HITL

Behavior: queues hydrate and persist by account plus tenant.
Blocked by: migration decision for legacy unstamped vouchers.
```

Use the labels deliberately:

- **AFK** means Sandcastle can implement it on a branch.
- **HITL** means Codex should stop and ask for a human decision before implementation.
- **parallel-ready** means the slice can run beside other slices without sharing files or branch state.
- **sequenced** means the slice should start from a previous branch after validation.

The important distinction:

- Use **iterations** when one long plan should keep going on the same branch until it is done.
- Use **parallel branches** when independent slices can be implemented at the same time.
- Use **subagents** to improve the plan or review the result, not as the durable AFK executor.

## Example: One Long Plan

Use one branch and multiple iterations when the task is cohesive:

```ts
import { run, pi } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

await run({
  name: "tenant-scoped-persistence",
  agent: pi("openai-codex/gpt-5.5"),
  sandbox: docker(),
  branchStrategy: {
    type: "branch",
    branch: "codex/tenant-scoped-persistence",
  },
  promptFile: ".sandcastle/tenant-scoped-persistence.md",
  maxIterations: 8,
});
```

The same branch, worktree, and sandbox lifecycle are reused across iterations. This is the behavior that lets a long plan continue instead of restarting from scratch every turn.

## Example: Parallel Slices

Use multiple `run()` calls when slices are independent:

```ts
const slices = [
  {
    name: "attachment-logical-failure",
    branch: "codex/attachment-logical-failure",
    promptFile: ".sandcastle/prompts/attachment-logical-failure.md",
  },
  {
    name: "voucher-sync-single-flight",
    branch: "codex/voucher-sync-single-flight",
    promptFile: ".sandcastle/prompts/voucher-sync-single-flight.md",
  },
];

await Promise.all(
  slices.map((slice) =>
    run({
      name: slice.name,
      agent: pi("openai-codex/gpt-5.5"),
      sandbox: docker(),
      branchStrategy: { type: "branch", branch: slice.branch },
      promptFile: slice.promptFile,
      maxIterations: 5,
    }),
  ),
);
```

Run slices sequentially when they touch the same files or one slice depends on another slice's diff.

## Pi Subscription Auth

The `pi-codex` init path avoids API-key setup. Instead, it expects the host to be logged in to Pi.

For Docker and Podman, generated templates mount the host Pi agent directory into the sandbox:

```text
~/.pi/agent -> /home/agent/.pi/agent
```

This is convenient, but it is sensitive. The sandbox receives access to your Pi OAuth tokens. Use this only with local sandbox providers and repos you trust. Do not reuse this local OAuth mount strategy for arbitrary cloud sandboxes.

## Windows Notes

Large agent runs create worktrees, dependency trees, logs, and sandbox artifacts. On Windows, deep paths can cause cleanup failures, especially under OneDrive.

Recommended mitigations:

- keep active repos under short paths such as `C:\src\repo`
- configure a short `worktreeRoot` for large AFK runs
- treat preserved worktrees as recovery state, not trash
- inspect branches and diffs before deleting failed-run artifacts

Example:

```ts
await run({
  agent: pi("openai-codex/gpt-5.5"),
  sandbox: docker(),
  promptFile: ".sandcastle/prompt.md",
  worktreeRoot: "C:\\sandcastle-worktrees",
});
```

## Core API Options For This Workflow

```ts
await run({
  agent: pi("openai-codex/gpt-5.5"),
  sandbox: docker(),
  promptFile: ".sandcastle/prompt.md",

  // Keep working across multiple agent turns.
  maxIterations: 5,

  // Put work on a named review branch.
  branchStrategy: {
    type: "branch",
    branch: "codex/my-afk-task",
  },

  // Useful on Windows or any repo with deep paths.
  worktreeRoot: "C:\\sandcastle-worktrees",

  // Write logs to a predictable file.
  logging: {
    type: "file",
    path: ".sandcastle/logs/my-afk-task.log",
  },
});
```

Important result fields:

- `iterations`: per-iteration agent results
- `commits`: commits created by the run
- `branch`: branch where the work landed
- `preservedWorktreePath`: path to inspect if cleanup could not remove the worktree

## Troubleshooting

`pi` is not authenticated:

```bash
pi /login
```

Model is unavailable:

```bash
pi --list-models openai
```

Docker image is missing:

```bash
npx sandcastle docker build-image
```

Find logs:

```bash
ls .sandcastle/logs
```

Find generated work:

```bash
git branch --list "codex/*"
git worktree list
```

Recover from a failed run by inspecting logs, branches, and preserved worktrees before rerunning. If the run failed during cleanup, the implementation work may still have completed and committed.

## Relationship To Upstream

Upstream Sandcastle is a general TypeScript library for orchestrating AI agents in isolated sandboxes. This fork keeps that foundation, but optimizes the default story around Codex/Pi subscription-backed AFK delivery:

- `pi-codex` init path
- Pi auth mount for Docker/Podman
- durable multi-iteration branch lifecycle
- optional custom worktree roots
- Codex dispatch skill packaged in `skills/`
- workflow-first docs for vertical-slice AFK delivery

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The package currently exports Sandcastle's programmatic API and sandbox providers:

```ts
import { run, pi, claudeCode, codex, opencode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";
import { vercel } from "@ai-hero/sandcastle/sandboxes/vercel";
```

## License

MIT. This fork builds on upstream Sandcastle by Matt Pocock and contributors.
