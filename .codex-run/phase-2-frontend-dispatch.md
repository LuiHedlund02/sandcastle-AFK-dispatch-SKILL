# Phase 2 — Frontend Slice Dispatch

You are an Opus 4.7 subagent dispatched by the parent Claude session for Sandcastle Phase 2 frontend work. The Phase 2 backend just committed (`5666128 engine`, `07fa1b2 protocol`, `fdc38ca control-core`). Your scope: the multi-target deploy chord parser + WinPendingDecisionCard primitive + AppChrome wiring + a small `useMergeAllGreen` mutation hook.

## Read first (in this order)

1. `docs/IMPLEMENTATION_PLAN.md` §7 Phase 2 — outcome you contribute to.
2. `docs/mockups/index.html` — open the inline `<style>` and look at the `.sc-chord-bg` overlay; this is the visual target for the chord. Also `cockpit.html` for the win-pending decision card style.
3. `packages/ui/src/deploy/DeployChordOverlay.tsx` + `.module.css` — the existing single-target chord that you will extend.
4. `packages/ui/src/index.ts` — the barrel; you'll add new exports.
5. `packages/protocol/src/api.ts` and `state.ts` — the Phase 2 wire format you consume (`zPostMergeAllGreenResponse`, `zPostRunDecisionRequest`, `BranchStrategy`).
6. `apps/desktop/src/AppChrome.tsx` — where the deploy chord lives today; you'll wire the multi-target mutate path here.
7. `apps/desktop/src/api/{client,queries}.ts` — extend with `mergeAllGreen` + `decideRun` + multi-target `createRun` calls.
8. `apps/desktop/src/state/fleetStore.ts` — read win-pending/fail-pending status from here for decision card surfacing.

## Outcome (what "done" means)

User can:

1. Hit `⌘D` / `Ctrl+D` and type a directive that targets multiple planets in one chord. The parser shows a live preview of which planets the directive will dispatch to. Submitting fans out parallel `POST /runs` calls — one per planet — each with the shared directive. The fleet dock fills with N concurrent cells (already wired by Phase 0 fleet snapshots).
2. See a mini "decision card" pop from any dock cell that hits `win-pending` or `fail-pending`. Clicking the card opens an inline action surface — Merge / Revise / Discard for win-pending, Revise / Discard for fail-pending — each calling `POST /runs/:id/decide` with the right kind.
3. See and use a "Merge all green" action in the FleetDock primitive that's gated behind "all win-pending runs verified green," wires through to `POST /merge-all-green`, and reports per-run results.

That's the entire deliverable. No other route changes.

## Hard rules

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files.
- **No edits under** `src/`, `packages/control-core/`, or `packages/protocol/`.
- **`packages/ui/` is yours to extend** (additive only — don't break existing primitive APIs that other screens consume).
- **`apps/desktop/`** is yours to wire. Touch `AppChrome.tsx`, `api/client.ts`, `api/queries.ts`. Do not modify the 5 Phase 1 route files unless one breaks because of an additive primitive prop change (in which case stop and report).
- **Reduced motion / high contrast guards** apply to anything new. Use the existing tokens.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Do not commit.** Leave the working tree dirty.

## What to build

### 1. Multi-target deploy chord parser (`packages/ui/src/deploy/`)

Extend the existing `DeployChordOverlay` to support multi-target syntax. The parser is **rule-based and inline**, not LLM. Grammar:

```
deploy [<operative-id>] to <target>[, <target>]* :: <directive>
deploy to <target>[, <target>]* :: <directive>     // operative defaults to "current focus"
<directive>                                         // single-target; current planet, default operative
```

Where `<target>` is a planet repo name or repo id; matching is case-insensitive substring against `Planet.repoName` first, then `Planet.id`. If no target is parsed, the chord defaults to the current planet (preserving Phase 0 behavior). Output a `ParsedDeploy` shape:

```ts
interface ParsedDeploy {
  readonly operativeId?: string; // undefined = "current"
  readonly targets: readonly {
    id: string;
    repoName: string;
    matched: string;
  }[];
  readonly directive: string;
  readonly unknownTargets: readonly string[]; // typed but no match — render as warnings
}
```

Add a parser preview row inside the overlay that shows: parsed operative, parsed target chips (or "current planet" pill), unknown-target warnings, the directive preview. The submit handler calls a new prop `onMultiSubmit({ operativeId, targets, directive })`.

Keep the existing single-submit flow for backward compatibility — if `onMultiSubmit` isn't provided, fall back to `onSubmit({ directive })`.

### 2. WinPendingDecisionCard primitive (`packages/ui/src/fleet/`)

Mini card that pops over a dock cell when its run is win-pending or fail-pending. Shape:

```tsx
<WinPendingDecisionCard
  run={run}                              // Run from @sandcastle/protocol
  onDecide={(kind) => void}              // "merge" | "revise" | "discard"
  pending?: boolean                      // disable buttons during a mutation
/>
```

For win-pending: shows directive summary, branch, "all checks green," and three buttons (Merge / Revise / Discard). For fail-pending: shows failed checks, two buttons (Revise / Discard). Use `OctaPanel` tone variants — green for win, amber for fail. Reduced-motion safe.

Add it as a sibling export from `@sandcastle/ui`, surfaced from `FleetDockCell` when its run reaches a pending state. Consumer screens (the dock in AppChrome) opt in via a new prop on FleetDock: `onDecide(runId, kind) => void`.

### 3. MergeAllGreenButton — make it real

The existing `MergeAllGreenButton` primitive in `packages/ui/src/fleet/` is currently a static gated button. Extend its props:

```tsx
<MergeAllGreenButton
  enabled={boolean}                        // gated behind "all win-pending verified green"
  onClick={() => void | Promise<void>}     // mutation callback
  pending?: boolean                        // mid-mutation
  result?: { ok: number; failed: number; aborted: boolean }   // after click, brief flash of result
/>
```

Surface it in `FleetDock`'s right-side actions; pipe through to the parent.

### 4. Desktop wiring (`apps/desktop/src/`)

- **`api/client.ts`**: add `mergeAllGreen()` and `decideRun(runId, kind)` methods that hit `POST /merge-all-green` and `POST /runs/:id/decide` with the existing bearer auth pattern. Multi-target deploy is `Promise.all` of `createRun()` calls — no new API method needed.
- **`api/queries.ts`**: add `useMergeAllGreen()` and `useDecideRun(runId)` mutations. Both invalidate `queryKeys.fleet` and (for decideRun) `queryKeys.run(runId)`.
- **`AppChrome.tsx`**: extend the deploy chord submit to honor multi-target — fan out N `createRun` calls in parallel, navigate to the cockpit of the _first_ success (or stay on current page if all are headless). Wire `onDecide` from FleetDock through `useDecideRun(runId).mutate(kind)`. Wire `onMergeAllGreen` through the new mutation.

## Tests

```
packages/ui/test/
  deploy/DeployChordParser.test.tsx
    - "fix the bug" → 1 target (current), 1 directive
    - "deploy to alpha, beta :: refactor" → 2 targets, no operative, directive
    - "deploy pi-default to alpha :: do thing" → operative + 1 target + directive
    - "deploy to alpha, ghost :: x" with no "ghost" planet → 1 target + 1 unknown
    - empty / whitespace-only → no targets, empty directive
  fleet/WinPendingDecisionCard.test.tsx
    - win-pending: renders 3 buttons; clicking each fires onDecide with the right kind
    - fail-pending: renders 2 buttons; merge button absent
    - pending=true disables all buttons
  fleet/MergeAllGreenButton.test.tsx
    - enabled=false: button disabled
    - enabled=true + onClick fires
    - result.ok > 0 shows in label / a brief flash
```

## Verification you must run before reporting done

- [ ] `npm run typecheck` from repo root — green across all 5 workspaces
- [ ] `npm test -w @sandcastle/ui` — existing 14 + your new ones all pass
- [ ] `npm run build -w @sandcastle/desktop` — green
- [ ] `npm pack --dry-run` from repo root — still 222 files
- [ ] If you can boot Electron: `npm run dev:desktop` and confirm the chord parses multi-target syntax in the UI; otherwise say so explicitly.

If a step blows up, say so. Don't silently skip.

## Open decisions you may resolve

1. **Decision card placement**: tooltip-style popup on hover, or always-visible inline expansion below the cell? Always-visible is simpler and matches the cockpit's win/fail-pending callouts; recommended.
2. **Markdown in directive**: still render as plain text — Phase 2 doesn't need formatting.
3. **Multi-target submit rollback**: if 3 of 5 deploys succeed and 2 fail, do we cancel the 3 successful ones? **No** — they're independent runs. Show a toast / inline notice with the failed targets but let the successes ride.
4. **Empty directive guard**: keep the existing "submit disabled when directive empty" behavior. Multi-target with empty directive is invalid.

## Deliverable

Working tree dirty:

- `packages/ui/src/deploy/` extended with parser + multi-submit
- `packages/ui/src/fleet/WinPendingDecisionCard.tsx` (+ `.module.css`)
- `packages/ui/src/fleet/MergeAllGreenButton.tsx` extended
- `packages/ui/src/index.ts` re-exports
- `packages/ui/test/` new test files
- `apps/desktop/src/api/{client,queries}.ts` extended
- `apps/desktop/src/AppChrome.tsx` wires multi-target deploy + decide + merge-all-green
- A `.changeset/phase-2-frontend.md` patch entry

Report:

1. File tree (added / modified)
2. Verification results (typecheck output tail, test pass counts, npm pack count, smoke test outcome or unable-to-run note)
3. Any deviations or open items with reason
