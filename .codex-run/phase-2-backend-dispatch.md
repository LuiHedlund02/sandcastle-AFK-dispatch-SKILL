# Phase 2 — Backend Slice Dispatch

You are gpt-5.5 (Codex), dispatched by Claude (Opus 4.7) to build the **backend** half of Sandcastle Phase 2. Phase 0 + Phase 1 are committed and shipping. This dispatch implements the worktree-concurrency fix, the RepoRunCoordinator, and the FleetBudgetService — the parts of Phase 2 that the frontend's multi-target deploy chord depends on.

Read these first (do not skip):

1. `docs/IMPLEMENTATION_PLAN.md` §2.3 (worktree concurrency findings) and §7 Phase 2 — the contract you're delivering.
2. `src/WorktreeManager.ts` — the file with the concurrency bugs you're fixing. ~376 lines. Read all of it.
3. `src/run.ts` and `src/Orchestrator.ts` — the engine entry points; understand how WorktreeManager is consumed today before you change semantics.
4. `packages/control-core/src/runs/RunSupervisor.ts` and `RunIdAllocator.ts` — the runId source.
5. `packages/control-core/src/server.ts` — where new HTTP routes for "merge all green" and decisions land.
6. `packages/protocol/src/{state,api,events}.ts` — the wire format you may need to extend.
7. `git log --oneline -10` — recent commit-message style.

## What "done" means for Phase 2 backend

The "5 parallel runs to the same repo" promise becomes real:

1. **runId-based branch names**. `generateTempBranchName` and the named-branch path inside `WorktreeManager.create*` accept (or are replaced with) a `runId: string` argument so two runs launched in the same wall-clock second cannot collide. New shape: `sandcastle/<runId>` and `sandcastle/<sanitized-name>/<runId>`. The current timestamp-only path stays available as a fallback when no runId is passed (engine compat) but is deprecated in jsdoc.
2. **`RepoRunCoordinator`** (new, in control-core) serializes risky operations _per repo_:
   - **Merge serialization**: only one merge into the repo's default branch can be in flight at a time (mutex per repo+target-branch).
   - **Branch-mode lock**: in explicit-branch mode (named branch reuse), only one active run per branch.
   - **Head strategy guard**: the `head` worktree strategy is _disallowed_ for parallel UI runs — the coordinator surfaces a clear `HeadStrategyNotParallelError` when a UI run requests it while another is active on the same repo.
   - **Allocate runId** before any worktree work happens, so the runId is available to `WorktreeManager`.
3. **`FleetBudgetService`** (new, in control-core) caps concurrent runs across the fleet:
   - Reads `concurrencyCap` from each operative's identity.
   - Per-repo cap: at most N runs targeting the same repo at the same time (start with N = 5; configurable via `repoConcurrencyCap`, default 5).
   - Returns a structured rejection (`BudgetExceededError`) when a deploy would exceed either cap, with which dimension was hit.
4. **`POST /merge-all-green`** new route: walks all win-pending runs, calls into the engine's existing merge path one at a time (using the merge mutex), returns a per-run result list. Aborts on the first failure but does not roll back already-merged runs.
5. **Decision actions wired through HTTP**: `POST /runs/:id/decide` body `{ kind: "merge" | "revise" | "discard" }`. For Phase 2, only `discard` and `merge` are required to do something real — `revise` accepts the call and returns 200 but no-ops in the engine (Phase 3 wires the actual revise path).

## Hard rules (will be checked)

- **Public API of `@ai-hero/sandcastle` stays additive.** `npm pack --dry-run` from repo root still 222 files. New exports are fine if needed (e.g., a `runId` option on existing run options); deletions or renames of the published surface are not.
- **WorktreeManager changes must be backwards compatible.** Existing callers that don't pass a runId keep working (with the timestamp fallback path). The published JS API stays the same shape.
- **Engine `src/` changes are limited to `WorktreeManager.ts`** unless you find a hard-blocker that requires touching `run.ts` or `Orchestrator.ts` to thread the runId — in that case stop and report before silent edits.
- **Effect-TS stays inside the engine.** Control-core's RepoRunCoordinator and FleetBudgetService are plain TS classes (the engine is Effect; control-core is plain TS). Do not "Effectify" control-core to match the engine.
- **Mutexes must be safe under crashes / aborts.** Use a queue of pending operations + an in-flight flag; release in `finally`. Tests must cover the abort case.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Tests must run.** Pure unit tests for the coordinator + budget service (no real git). One integration test exercising 5 parallel runs against a fixture `git init` repo using the engine's `no-sandbox` provider, asserting no branch-name collisions.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Don't commit.** Leave the working tree dirty.
- **No `--no-verify`** or hook-bypass flags anywhere.

## Layout to add / modify

```
src/
  WorktreeManager.ts                      # MODIFY (additive runId support, deprecated timestamp fallback)

packages/protocol/src/
  state.ts                                # ADD: BudgetExceededError shape if surfaced over HTTP, MergeAllGreenResponse shape, RunDecisionRequest
  api.ts                                  # ADD: zPostMergeAllGreenResponse, zPostRunDecisionRequest/Response

packages/control-core/src/
  runs/
    RepoRunCoordinator.ts                 # NEW: per-repo merge mutex, branch-mode lock, head-strategy guard
    RunSupervisor.ts                      # MODIFY: route runs through RepoRunCoordinator, allocate runId before worktree work
  fleet/
    FleetBudgetService.ts                 # NEW: per-operative + per-repo cap enforcement
  decisions/
    DecisionActions.ts                    # NEW: implements merge / discard / revise (revise no-op for now)
  server.ts                               # ADD POST /merge-all-green and POST /runs/:id/decide
```

## Tests to write (must all pass)

```
packages/control-core/test/
  runs/RepoRunCoordinator.test.ts
    - 100 parallel runs to the same repo allocate 100 unique branches (no collisions)
    - merge mutex serializes 5 simultaneous merges to the same default branch
    - branch-mode lock rejects a second run on the same explicit branch
    - head strategy returns HeadStrategyNotParallelError when a second parallel run requests it
    - releases on abort: a coordinator-held lock is released even when the supervised run rejects
  fleet/FleetBudgetService.test.ts
    - rejects when operative cap exceeded
    - rejects when repo cap exceeded
    - allows when both caps have headroom
    - structured error includes the dimension that failed (operative/repo)
  decisions/DecisionActions.test.ts
    - merge: calls engine merge path under the mutex; returns success/failure
    - discard: deletes the run's worktree + branch
    - revise: 200 + no-op (Phase 2 placeholder)
  server.merge-all-green.test.ts
    - returns per-run results for win-pending runs
    - bearer auth required
    - early-aborts on first failure, returns partial results
  server.run-decide.test.ts
    - POST /runs/:id/decide with each kind
    - 404 on unknown run id
```

## Verification you must run before reporting done

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/protocol`: still all green
- [ ] `npm test -w @sandcastle/control-core`: all green (existing 29 + your new ones)
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] If your environment can run vitest against a git fixture, run the 100-parallel-runs allocator test and confirm 0 collisions. If your sandbox blocks git/spawn, say so explicitly — do not skip the test silently.

## Open questions you may resolve as you see fit

1. **Coordinator vs supervisor relationship** — your call whether the coordinator wraps the supervisor or the supervisor wraps the coordinator. Pick the shape that lets a single run path flow through both with minimal injection ceremony.
2. **Mutex implementation** — a small Promise-chained queue is fine; no need for `async-mutex` etc. unless you flag it. Keep it dependency-free.
3. **runId at the engine boundary** — easiest change is a new optional `runId?: string` field on `WorktreeRunOptions` / `createWorktree` config. Plumb it without changing existing mandatory fields.
4. **Default `repoConcurrencyCap`** — start at 5 (per IMPLEMENTATION_PLAN). Configurable via constructor option.
5. **`POST /merge-all-green` failure behavior** — IMPLEMENTATION_PLAN doesn't specify "abort on first" vs "continue past failures." Going with "abort on first failure, return partial results" is safer; flag if you'd rather do the other thing.

## What is OUT of scope

- Frontend (separate Opus subagent): multi-target deploy chord parser, WinPendingDecisionCard primitive
- QuestForge phase parser (Phase 3)
- Real telemetry from coverage/CI/issues/churn (Phase 4)
- XP ledger (Phase 4)

## Deliverable

Working tree dirty:

- `src/WorktreeManager.ts` updated (additive runId), engine compat preserved
- `packages/control-core/src/runs/RepoRunCoordinator.ts` + tests
- `packages/control-core/src/fleet/FleetBudgetService.ts` + tests
- `packages/control-core/src/decisions/DecisionActions.ts` + tests
- `packages/protocol/src/{state,api}.ts` extensions
- `packages/control-core/src/server.ts` with 2 new routes
- A `.changeset/phase-2-coordinator.md` patch entry

Report:

1. File tree of additions / modifications
2. Verification results (typecheck output tail, each test suite pass count, npm pack count, smoke test outcome)
3. Any open items or deviations with reason
4. Anything you noticed in the engine that needs touching but didn't (we'll triage)
