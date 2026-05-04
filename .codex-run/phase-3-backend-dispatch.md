# Phase 3 — Backend Slice Dispatch

You are gpt-5.5 (Codex), dispatched by Claude (Opus 4.7) to build the backend half of Phase 3 of Sandcastle. Phase 0 + 1 + 2 are committed and shipping. Your scope: the **QuestForge parser**, **VerifyRule schema + executor**, **PhasedRunOrchestrator**, and the **HTTP routes** that surface them.

Read these first (do not skip):

1. `docs/IMPLEMENTATION_PLAN.md` §7 Phase 3 and §9 #3 (parser approach question — we're going **deterministic rule-based** for v1; LLM polish is Phase 4+).
2. `packages/protocol/src/state.ts` — `zPhase` already exists with the shape you'll project into. Read lines 148–161.
3. `packages/control-core/src/runs/{RepoRunCoordinator,RunSupervisor}.ts` — your phased orchestrator wraps these, doesn't replace them.
4. `apps/desktop/src/routes/quest-forge.tsx` — the Phase 1 stub parser; you're replacing this conceptually with a real backend parser + a route that calls it.
5. `git log --oneline -8` — commit message style.

## What "done" means for Phase 3 backend

1. **`QuestForgeParser`** (deterministic, rule-based) takes a directive string → returns an array of `ParsedPhase` objects. Each phase has: title (≤ 60 chars), directiveSlice (the original text segment), objective (extracted or synthesized), xpEstimate (50 base + 25 per detected verb / numbered marker, capped at 250 per phase), and verifyRules (array of structured `VerifyRule` objects, see §2). The parser splits on:
   - Blank lines (`\n{2,}`)
   - Imperative-verb sentence starts: `Add|Fix|Refactor|Test|Document|Reproduce|Diagnose|Patch|Commit|Implement|Remove|Update|Verify|Build|Migrate|Replace|Introduce|Extract|Rename|Reorganize|Move|Delete`
   - Numbered list markers: `^\s*\d+[.)]\s+|^\s*step\s+\d+\s*:`
   - Sentence boundaries within a line (`(?<=[.!?])\s+(?=[A-Z])`) — but only if the new sentence starts with a recognized verb.

   Heuristic verify-rule extraction: if the directive contains "test" or "tests pass", auto-add a `tests:all` rule. If it contains "build" or "compile", auto-add a `command:npm run build` rule. If it contains "type" / "typecheck", auto-add `command:npm run typecheck`. Otherwise default to `[]` and let the user add via the UI editor.

2. **`VerifyRule` schema** (zod, in protocol):

   ```ts
   type VerifyRule =
     | { kind: "command"; command: string; expectExit?: number } // run shell command, default expectExit 0
     | { kind: "tests"; pattern?: string } // run vitest with optional pattern
     | { kind: "file"; path: string; mustExist: boolean } // assert file exists / is absent
     | { kind: "commits"; minCount: number }; // assert >= N commits since start
   ```

   With a corresponding `VerifyRuleResult = { rule: VerifyRule, ok: boolean, output?: string, durationMs: number }`.

3. **`VerifyRuleExecutor`** (control-core) takes a worktree path + rule list, runs each rule sequentially with a 30s timeout per rule, returns the result list. `kind: command` uses `execFile` not `exec` (no shell injection). `kind: tests` runs `npx vitest run [pattern]` in the worktree. `kind: commits` uses `git rev-list --count HEAD ^<base>` against the run's base commit (recorded when phase starts).

4. **`PhasedRunOrchestrator`** (control-core) runs phases sequentially within a single Sandcastle run: each phase fires the engine's `run()` with the phase's directiveSlice, waits for the engine to signal completion, then runs the phase's verifyRules. If any verify fails → the run goes to `fail-pending` with the failed phase + checks; user can revise or discard. If all phases verify → `win-pending` waiting for merge decide. Emits new `phase.started` / `phase.verifying` / `phase.verified` / `phase.failed` events through the supervisor's existing event subscriber pattern.

5. **Protocol additions** (additive only):
   - `zVerifyRule` (discriminated union), `zVerifyRuleResult`
   - Replace `verifyRules: z.array(z.string())` on `zPhase` with `verifyRules: z.array(zVerifyRule)`. **This is the one breaking shape change.** Existing callers that read `phase.verifyRules` as strings need to migrate; nothing in production reads them yet (Phase 1 quest-forge stubs returned `[]`).
   - New events: `phase.started`, `phase.verifying`, `phase.verified`, `phase.failed` on the existing `RunEvent` union (additive).
   - HTTP: `POST /quest-forge/parse` body `{ directive: string }` → `{ phases: ParsedPhase[] }`. `POST /quest-forge/engage` body `{ directive: string, phases?: ParsedPhase[], operativeId?, branchStrategy? }` → starts a phased run, returns `{ runId }`. If `phases` omitted, parse from `directive`; if provided (user edited in UI), use as-is.

6. **Backwards compat**: existing `POST /runs` keeps creating an unphased run (single phase implicit). The phased orchestrator is opt-in via `/quest-forge/engage`.

## Hard rules

- **Public API of `@ai-hero/sandcastle` stays additive.** `npm pack --dry-run` from repo root still 222 files.
- **No engine `src/` changes.** Phase 3 lives entirely in control-core + protocol.
- **Effect-TS stays inside the engine.** Control-core stays plain TS.
- **Verify rules execute in subprocesses, not in-process.** Use `execFile` and `node:child_process.spawn`. Never `eval` or `Function()`.
- **Per-rule timeout 30s.** No infinite loops if a verify hangs.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Tests must run.** Parser fixtures (≥20), VerifyRule schema parse, executor unit (with a fixture git repo for `kind: commits`), orchestrator integration that runs 2 phases through the existing fakeAgent and asserts both phase events fire in order.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Don't commit.** Leave the working tree dirty.

## Layout to add / modify

```
packages/protocol/src/
  state.ts          # MODIFY: zVerifyRule + zVerifyRuleResult; zPhase.verifyRules → array of zVerifyRule
  events.ts         # ADD: phase.started / phase.verifying / phase.verified / phase.failed events
  api.ts            # ADD: zPostQuestForgeParseRequest/Response, zPostQuestForgeEngageRequest/Response

packages/control-core/src/
  quest-forge/
    QuestForgeParser.ts            # NEW: deterministic phase parser
    VerifyRule.ts                  # NEW: type guards + helpers
    VerifyRuleExecutor.ts          # NEW: runs rules against a worktree
    PhasedRunOrchestrator.ts       # NEW: orchestrates phased runs
  runs/
    RunSupervisor.ts               # MODIFY: route phased runs through PhasedRunOrchestrator (existing single-phase path unchanged)
  server.ts                        # ADD: POST /quest-forge/parse, POST /quest-forge/engage
```

## Tests to write (must all pass)

```
packages/control-core/test/
  quest-forge/QuestForgeParser.test.ts
    - 20 directive fixtures covering:
      * single sentence ("fix the bug")
      * imperative-verb sequences ("Add X. Refactor Y. Test Z.")
      * numbered lists ("1. Read. 2. Write. 3. Test.")
      * blank-line block separators
      * mixed casing
      * unicode / emoji preserved
      * trailing punctuation handling
      * empty directive → 0 phases
      * whitespace-only → 0 phases
      * verify-rule extraction (mentions of "test" → tests:all rule)
  quest-forge/VerifyRule.test.ts
    - zod parse: each kind valid + invalid cases
  quest-forge/VerifyRuleExecutor.test.ts
    - command success (echo) + non-zero exit failure
    - file: assert exists + must not exist
    - commits: against fixture git repo, count correct
    - tests: skip in CI if vitest not on PATH; otherwise run a one-test fixture
    - timeout: a 60s sleep rule fails after 30s
  quest-forge/PhasedRunOrchestrator.test.ts
    - 2 phases, both verify pass → run reaches win-pending
    - 2 phases, second verify fails → run reaches fail-pending with failed phase id
    - 1 phase, abort midway → run reaches aborted
  server.quest-forge.test.ts
    - POST /quest-forge/parse echoes a deterministic phase array
    - POST /quest-forge/engage with phases starts a run and returns runId
    - both routes require bearer auth
```

## Verification you must run before reporting done

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/protocol`: still all green (you'll need to update existing zPhase fixtures because verifyRules is no longer string[])
- [ ] `npm test -w @sandcastle/control-core`: all green (existing 51 + your new ones)
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] If your env can run a real subprocess for VerifyRuleExecutor's `command:` rule, run that test. If sandbox blocks spawn/git, say so explicitly — do not skip.

## Open decisions you may resolve

1. **Parser ordinal numbering**: 1-indexed (mockup-friendly) or 0-indexed (developer-friendly)? Use 1-indexed in the API, store with the phase as written. Tests assert against the API output.
2. **Per-phase XP cap**: 250 per phase, 1000 total per run (Phase 4 enforces — for now just record the estimate honestly).
3. **Phase abort semantics**: if a phase is aborted mid-execution, mark it `skipped`, mark all subsequent phases `skipped`, run goes to `aborted`. Do not run their verify rules.
4. **Verify rule auto-extraction confidence**: keep it conservative — only add a rule if the directive's text matches one of the heuristic phrases. Otherwise leave the array empty and let the UI editor fill it in.
5. **Engine merge path for phased runs**: same as Phase 2 — DecisionActions handles it. The orchestrator just decides win-pending vs fail-pending.

## What is OUT of scope

- LLM-generated parser polish (Phase 4+)
- Combat screen (separate Opus subagent dispatch)
- QuestForge UI editor (separate dispatch)
- XP ledger (Phase 4)

## Deliverable

Working tree dirty:

- `packages/protocol/src/{state,events,api}.ts` extensions
- `packages/control-core/src/quest-forge/` new
- `packages/control-core/src/runs/RunSupervisor.ts` integration
- `packages/control-core/src/server.ts` routes
- All tests
- `.changeset/phase-3-quest-forge.md` patch entry

Report:

1. File tree of additions / modifications
2. Verification results (typecheck, each test suite pass count, npm pack count, any blocked steps)
3. Any open items or deviations
4. Any engine bugs you spotted but didn't touch (we triage separately)
