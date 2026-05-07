# Phase 3 — Frontend Slice Dispatch

You are an Opus 4.7 subagent dispatched by the parent Claude session for Sandcastle Phase 3 frontend work. The Phase 3 backend just committed (`383cc20 protocol`, `e6c235b control-core`). Your scope: the **Combat screen primitives + route**, the **QuestForge phase editor wiring** (replace Phase 1's heuristic preview with real `POST /quest-forge/parse` + `engage` round-trip), and the **API client + queries** for those.

## Read first (in this order)

1. `docs/IMPLEMENTATION_PLAN.md` §7 Phase 3 — outcome you contribute to.
2. `docs/mockups/combat.html` — the visual ground truth for the Combat screen. Inline `<style>` shows the turn-based fight skin.
3. `docs/mockups/quest-forge.html` — phase editor visual reference; the Phase 1 stub already approximates this layout.
4. `apps/desktop/src/routes/quest-forge.tsx` — current Phase 1 stub. You're replacing the heuristic parser with a real backend call and adding an engage button that dispatches a phased run.
5. `packages/protocol/src/{state,events,api}.ts` — `ParsedPhase`, `VerifyRule`, `VerifyRuleResult`, `phase.*` events, `zPostQuestForgeParseRequest/Response`, `zPostQuestForgeEngageRequest/Response`.
6. `packages/ui/src/index.ts` — barrel; you'll add new exports for Combat primitives.
7. `apps/desktop/src/api/{client,queries}.ts` — extend with `parseQuestForge`, `engageQuestForge`.
8. `apps/desktop/src/routes.tsx` — add a `/runs/:runId/combat` route entry.
9. `apps/desktop/src/state/fleetStore.ts` — read run + phase state from here for the Combat screen's projection.

## Outcome (what "done" means)

User can:

1. Open `/quest-forge`, type a directive, see real backend-parsed phases (with verify rules surfaced as chips), edit phase titles / objectives / verify rules, then click an **Engage** button that fires `POST /quest-forge/engage` and navigates to the new run's **Combat** screen.
2. The Combat screen at `/runs/:runId/combat` re-skins the run timeline as a turn-based fight: each phase is a "round," each tool call is an "attack," verify rules are "saving throws." Phase events (`phase.started`/`verifying`/`verified`/`failed`) drive the animation/state. Pendings and resolutions surface inline.
3. Cockpit (`/runs/:runId/cockpit`) keeps working unchanged — Combat is an alternative view that the user opts into via a route param or link from the cockpit header.

That's the entire deliverable. Do **not** retouch Phase 1's quest-forge heuristic parser code — replace the relevant chunk with a `useQuestForgeParse` query hook driving a debounced backend call instead.

## Hard rules

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files.
- **No edits under** `src/`, `packages/control-core/`, or `packages/protocol/`.
- **`packages/ui/` extensions must be additive.** Don't break existing primitive APIs that the cockpit / Phase 1 screens consume.
- **Reduced motion / high contrast guards** apply to the combat skin — the "attack roll" / "crit" effects must degrade to plain text under `prefers-reduced-motion`.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Do not commit.** Leave the working tree dirty.

## What to build

### 1. Combat primitives (`packages/ui/src/combat/`)

- `CombatStage.tsx` — overall layout: top banner with operative + planet, scroll of phase rounds, sidebar with current verify state. Wraps in `OctaPanel`.
- `PhaseRound.tsx` — one phase as a "round." Header shows "ROUND <ordinal>: <title>", body lists tool calls as "ATTACK <tool name>" with arg preview. Idle / active / verifying / verified / failed visual states from the phase status.
- `AttackRoll.tsx` — one tool call line; subtle highlight on the active one. CSS keyframe animation gated behind `@media (prefers-reduced-motion: no-preference)`.
- `SavingThrow.tsx` — one verify-rule result row. Pass/fail glyph + rule label + duration. Use `describeVerifyRule` style strings (e.g. "command: npm run build", "tests: all", "file: <path>").
- `CombatHud.tsx` — sticky right-side dossier: HP-style bar showing % phases complete, list of verify rules across the run with current status, big "VICTORY" / "DEFEAT" / "PENDING" callout when the run resolves.

Reduced-motion: every animation listed must have a static fallback. CSS:

```css
@media (prefers-reduced-motion: reduce) {
  /* no transforms / opacity transitions; static colors only */
}
```

### 2. Phase editor primitive (`packages/ui/src/quest-forge/`)

- `PhaseEditorList.tsx` — vertical list of editable phase cards.
- `PhaseEditorCard.tsx` — one phase: title input, objective input, verify-rules multi-chip input (kind dropdown + the 1–2 fields per kind), reorder up/down buttons, delete button. Emits an `onChange(phases)` for the whole list.
- The verify-rule chip parses input strings like `command: npm test`, `tests: api`, `file: dist/main.js`, `commits: 1` into typed `VerifyRule` objects.

### 3. Desktop wiring (`apps/desktop/src/`)

- `api/client.ts`: add `parseQuestForge(directive)` and `engageQuestForge({ directive, phases?, operativeId?, branchStrategy? })` methods.
- `api/queries.ts`: add `useQuestForgeParse(directive)` (debounced 300ms, enabled when directive has > 4 chars) and `useEngageQuestForge()` mutation.
- `routes.tsx`: register `/runs/:runId/combat` → `CombatRoute`.
- `routes/quest-forge.tsx`: replace the Phase 1 heuristic with a real round-trip. Show backend-parsed phases via `PhaseEditorList`, allow user edits, click "Engage" → fires `useEngageQuestForge` mutation → navigates to `/runs/:runId/combat`.
- `routes/runs.$runId.combat.tsx`: NEW. Reads the run + phases from `useFleetStore` (live snapshot) and from `useRun(runId)` (TanStack). Composes `CombatStage` + `PhaseRound[]` + `CombatHud`. Includes a header link to `/runs/:runId/cockpit` for the alternative view.
- The cockpit screen's header gets a small "Combat view" link to the same run's `/combat` route. (One-line addition; flag if invasive.)

## Tests

```
packages/ui/test/
  combat/CombatStage.test.tsx
    - renders title + child rounds
    - hides motion under prefers-reduced-motion (assert no animation classes)
  combat/PhaseRound.test.tsx
    - all 4 status states render distinct visuals (assert classnames or aria-labels)
  combat/CombatHud.test.tsx
    - 0/3 phases verified renders 0% bar; 3/3 renders VICTORY callout when run.status === victory or win-pending
  quest-forge/PhaseEditorList.test.tsx
    - renders N cards from a phases prop
    - reorder up/down + delete fires onChange with the right new array
  quest-forge/PhaseEditorCard.test.tsx
    - editing title fires onChange with the title updated
    - parsing "command: npm test" into the verify-rules array works
```

## Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/ui`: existing 34 + your new ones all pass
- [ ] `npm run build -w @sandcastle/desktop`: green
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] If you can boot Electron: `npm run dev:desktop`, navigate to `/quest-forge`, confirm a typed directive shows real phases and Engage navigates to `/runs/:id/combat`. Otherwise say so explicitly.

## Open decisions you may resolve

1. **Combat layout density**: 3-column (operative left / phases center / hud right) or 2-column (phases center / hud right)? 2-column reads better at typical Electron window sizes; recommended.
2. **Phase editor verify-rule input**: free-text "kind: payload" parser (compact, types via parsing) or per-rule structured form (kind dropdown + fields)? Compact parser is faster for power users. Pick what feels honest; flag the choice.
3. **Cockpit ↔ Combat link**: small text link in the cockpit header is fine for v1. No view-mode toggle persistence yet.

## Deliverable

Working tree dirty:

- `packages/ui/src/combat/` new
- `packages/ui/src/quest-forge/` new
- `packages/ui/src/index.ts` re-exports
- `packages/ui/test/` new test files
- `apps/desktop/src/api/{client,queries}.ts` extended
- `apps/desktop/src/routes.tsx` registers `/runs/:runId/combat`
- `apps/desktop/src/routes/quest-forge.tsx` rewired
- `apps/desktop/src/routes/runs.$runId.combat.tsx` new
- `.changeset/phase-3-frontend.md` patch entry

Report:

1. File tree (added / modified)
2. Verification results (typecheck output tail, test pass counts, npm pack count, smoke test outcome or unable-to-run note)
3. Any deviations or open items with reason
