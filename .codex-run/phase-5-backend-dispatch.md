# Phase 5 — Backend Slice Dispatch

You are gpt-5.5 (Codex), dispatched by Claude (Opus 4.7) for Sandcastle Phase 5: **provider adapter materialization**. Phase 0–4 are committed. Your scope: implement the three adapters (Claude Code / Codex / Pi), wire them into the run pipeline, register cleanup paths, and ship a conformance test harness. Public API of `@ai-hero/sandcastle` stays at 222 files.

Read these first (do not skip):

1. `docs/IMPLEMENTATION_PLAN.md` §6 (provider adapter contract — already locked) and §7 Phase 5.
2. `packages/control-core/src/runs/RunSupervisor.ts` — where adapters slot in (just before `runImpl()` fires; cleanup goes in the `.finally()` block).
3. `packages/control-core/src/quest-forge/PhasedRunOrchestrator.ts` — the phased run path needs the same hook.
4. `packages/protocol/src/state.ts` — `Card` / `Deck` / `Planet` / `OperativeIdentity` / `Run` shapes you consume.
5. `git log --oneline -10` — commit message style.

## What "done" means for Phase 5

1. **`AgentProviderAdapter` interface** at `packages/control-core/src/adapters/AgentProviderAdapter.ts`, matching IMPLEMENTATION_PLAN §6 verbatim:

   ```ts
   interface ProviderMaterializedFile {
     relativePath: string;
     content: string;
   }
   interface ProviderAdapterInput {
     repoRoot: string;
     sandcastleDir: string;
     deck: Deck;
     planet: Planet;
     operative: OperativeIdentity;
     run: Run;
     directive: string;
   }
   interface ProviderAdapterOutput {
     files: ProviderMaterializedFile[];
     env?: Record<string, string>;
     promptPrelude?: string;
     cleanupPaths?: string[];
   }
   interface AgentProviderAdapter {
     id: ProviderId;
     materialize(input: ProviderAdapterInput): Promise<ProviderAdapterOutput>;
   }
   ```

2. **Three adapters** (each in its own file):
   - **`ClaudeCodeAdapter.ts`** writes:
     - `.claude/agents.md` — mode card body, prefixed with the operative's class/codename context
     - `.claude/skills/<slug>.md` for each enabled skill
     - `.claude/commands/<slug>.md` for each enabled command, formatted as a slash command (frontmatter + body)
     - `cleanupPaths`: `[".claude/"]`
   - **`CodexAdapter.ts`** writes:
     - `AGENTS.md` — concatenated mode + enabled skills + enabled commands as one document with section headers
     - `cleanupPaths`: `["AGENTS.md"]`
   - **`PiAdapter.ts`** writes:
     - `.pi/registry.json` — Pi's expected registry format with `mode`, `skills[]`, `commands[]` arrays each as `{ slug, title, body }`
     - `.pi/prompt.md` — mode body
     - `cleanupPaths`: `[".pi/"]`

   None of these adapters should commit anything. They write files into the worktree before the engine runs and remove them after. Files do not leak into git history because the orchestrator runs `git checkout -- <cleanupPaths>` on cleanup (or simply `rm` since they were never staged).

3. **`ProviderAdapterRegistry`** at `packages/control-core/src/adapters/ProviderAdapterRegistry.ts` — id-keyed registry with `get(providerId): AgentProviderAdapter`. Throws `UnknownProviderError` for unknown ids.

4. **Run pipeline integration**:
   - `RunSupervisor.startRun` and `RunSupervisor.startPhasedRun` (and `PhasedRunOrchestrator.run`) call `adapter.materialize()` after the worktree exists but before `runImpl()`. Materialized files are written into the worktree via `fs.writeFile` (mkdir-p). `env` and `promptPrelude` are merged into the engine call.
   - On `.finally()`, `cleanupPaths` are removed from the worktree (recursive rm).
   - Cleanup is best-effort — if it fails, log a warning but do not throw.

5. **Conformance test harness** at `packages/control-core/test/adapters/conformance.ts`:
   - A `runConformance(adapter)` helper that exercises a fixture deck (mode + 2 skills + 2 commands) against the adapter and asserts:
     - `output.files.length > 0`
     - All `relativePath` are repo-relative (no `..`, no leading `/`)
     - All `content` is non-empty for non-trivial cards
     - `cleanupPaths` cover all written files (no orphans)
   - Each adapter test file invokes `runConformance(adapter)` first, then snapshot-tests its specific output shape.

6. **Public surface (additive only)**:
   - `packages/control-core/src/index.ts` re-exports the adapter types (so consumers can implement custom adapters — Phase 6+ hosted-web extension point).
   - No protocol changes (the deck shape was already provider-neutral in Phase 1).

## Hard rules

- **Public API of `@ai-hero/sandcastle` stays additive.** `npm pack --dry-run` from repo root still 222 files.
- **No engine `src/` changes.** Phase 5 lives entirely in control-core.
- **No protocol changes.** The deck/card shapes are already provider-neutral.
- **Effect-TS stays inside the engine.** Adapters are plain async functions / TS classes.
- **All file writes use atomic patterns**: mkdir-p → write to tmp → rename. Cleanup is recursive `rm` with `force: true` and never throws.
- **Adapters never write outside the worktree.** Validate that all `relativePath`s resolve under the worktree root.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Tests must run.** Conformance + per-adapter snapshot tests + integration test that fires a full run with a Claude Code adapter and asserts `.claude/` is gone after the run completes (check `existsSync(.claude)` is false).
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Don't commit.** Leave the working tree dirty.

## Layout to add / modify

```
packages/control-core/src/
  adapters/
    AgentProviderAdapter.ts         # NEW: interface + types
    ProviderAdapterRegistry.ts      # NEW
    ClaudeCodeAdapter.ts            # NEW
    CodexAdapter.ts                 # NEW
    PiAdapter.ts                    # NEW
    materialize.ts                  # NEW: write files + register cleanup, mkdir-p, atomic
  runs/
    RunSupervisor.ts                # MODIFY: call adapter.materialize before run; cleanup in finally
  quest-forge/
    PhasedRunOrchestrator.ts        # MODIFY: same materialize/cleanup hook per phase OR once at run start (your call — pick once-at-run-start)
  index.ts                          # ADD: re-export adapter types
```

## Tests to write (must all pass)

```
packages/control-core/test/
  adapters/conformance.ts                       # shared harness
  adapters/ClaudeCodeAdapter.test.ts            # conformance + snapshot
  adapters/CodexAdapter.test.ts                 # conformance + snapshot
  adapters/PiAdapter.test.ts                    # conformance + snapshot
  adapters/ProviderAdapterRegistry.test.ts      # get / unknown / list
  adapters/materialize.test.ts                  # writes files into worktree, cleanup removes them, no-leftover assertion, mkdir-p, refuses absolute / .. paths
  RunSupervisor.adapter.test.ts                 # integration: end-to-end run materializes Claude Code files then cleans them up
```

## Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/protocol`: still all green (no protocol changes)
- [ ] `npm test -w @sandcastle/control-core`: all green (existing 120 + your new ones)
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] If your env can run a fakeAgent integration, run RunSupervisor.adapter.test.ts. If sandbox blocks spawn/git, say so explicitly.

## Open decisions you may resolve

1. **Phased-run materialization timing**: once at run start (before phase 1) is correct — phases share a worktree, so re-materializing per phase would fight itself. Cleanup at the very end (after the last phase, in the same finally block).
2. **Codex adapter `AGENTS.md` ordering**: mode → skills sorted by `slug` → commands sorted by `slug`. Stable for snapshot tests.
3. **Pi adapter format**: `.pi/registry.json` is the source-of-truth filename per the dispatch; if Pi's actual convention differs, leave a JSDoc comment flagging it for Phase 6 review. v1 just needs a stable shape.
4. **Cleanup vs `git stash`**: simple recursive `rm` is fine since the files are never staged. Don't try to be clever with stash.
5. **Concurrency**: two parallel runs in the same worktree (Phase 2 says no — head strategy disallowed for parallel UI runs); merge-to-head runs each have their own worktree, so each gets its own materialized provider files. No locking needed at the adapter level.

## What is OUT of scope

- Frontend (separate small follow-up if needed): a "materialized as: <files>" surface in the planet view. v1 ships backend only.
- Hosted-web v2 transport (Phase 6).
- Custom user adapters / plugin SDK.

## Deliverable

Working tree dirty:

- `packages/control-core/src/adapters/` populated
- `packages/control-core/src/runs/RunSupervisor.ts` integrated
- `packages/control-core/src/quest-forge/PhasedRunOrchestrator.ts` integrated
- `packages/control-core/src/index.ts` exports
- All tests
- `.changeset/phase-5-adapters.md` patch entry

Report:

1. File tree of additions / modifications
2. Verification results (typecheck, each test suite pass count, npm pack count, blocked steps if any)
3. Any open items, deviations, or engine bugs you spotted but didn't touch
