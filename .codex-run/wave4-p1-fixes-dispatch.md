# Wave 4 fix-up — P1 findings from the cross-review

Three P1 findings from the prior review need fixing. All are runtime/correctness, all touch state-machine or telemetry semantics. Stay backend + state-machine focused.

## Finding 1 — Micro-state decay timer doesn't re-arm for later deadlines

**Where:** `packages/screens/src/state/fleetStore.ts` (look for `scheduleDecay`, `tickMicroStates`).

**Issue:** `scheduleDecay` keeps only the earliest timer. When that timer fires, `tickMicroStates()` decays due entries but never re-schedules for the _next_ earliest pending deadline. So if two runs hit different decay deadlines, only the earlier one is processed; the later one stays stuck in `casting`/`striking`/`crit`/`hit` forever (until another run event happens to it).

**Fix:** After `tickMicroStates` runs and decays due entries, scan the post-tick `runMicroStates` map for the next-earliest non-null `decayAt` and call `scheduleDecay(nextDeadline)` to re-arm. While you're there, drop entries that have decayed back to `idle` with no further decay pending — keeps the map small.

**Verify:** add a test that fires two events with different decay deadlines and waits past both — both should reach idle.

## Finding 2 — `useOperativeMicroStates` returns a fresh object every render

**Where:** `packages/screens/src/state/useOperativeState.ts` (the `useOperativeMicroStates` hook). Compare against `useFleetMicroStateMap` in `useFleetMicroStateMap.ts` which correctly uses `useShallow`.

**Issue:** The selector inside `useOperativeMicroStates` builds a new `Record<runId, OperativeMicroState>` (or similar) on every store update. Without `useShallow` (or another stable equality check), every store mutation produces a "different" snapshot identity and triggers re-render. Under React 19 + zustand 5 this can manifest as `Maximum update depth exceeded` or `getSnapshot should be cached` warnings. The Galaxy build agent reported a transient instance of this.

**Fix:** Wrap the selector in `useShallow` from `zustand/react/shallow`, mirroring the pattern in `useFleetMicroStateMap`. Rerun the unit tests for the hook to make sure equality semantics still hold.

## Finding 3 — CI rate is fraction vs. percent inconsistency

**Where:**

- `packages/control-core/src/telemetry/ci/CiRateReader.ts` (returns raw percents like `50`)
- `packages/ui/src/galaxy/climate.ts` (compares against `0.85` — fraction semantics)
- `packages/screens/src/routes/galaxy.tsx` (renders `ciGreenRate30d * 100` — assumes fraction)

**Issue:** The reader emits percents (0..100); the climate threshold treats them as fractions (0..1); the display multiplies by 100 again. A repo with 50% CI gets classified as `clear` (because 50 ≥ 0.85 is true) and the panel renders "5000 %".

**Fix:** Standardize on **percent (0..100)** at the protocol boundary because the existing schema name is `ciGreenRate30d` and the reader returns percents. Adjust:

- `climate.ts`: change the `>= 0.85` check to `>= 85`. Update its tests in `packages/ui/test/galaxy/climate.test.ts` to match.
- `galaxy.tsx`: drop the `* 100` when rendering — render `ciGreenRate30d` directly with a `%` suffix.
- Confirm the protocol schema documentation comment (if any in `packages/protocol/src/state.ts`) reflects "0..100".

**Verify:** typecheck clean, climate tests pass, galaxy panel shows e.g. `48 %` (not `4800 %` and not `48.00`).

## Constraints

- Don't run vitest (the spawn EPERM hits on this machine). Just typecheck + read.
- Don't change the protocol schema's _shape_; you may add/clarify a doc comment about the unit.
- Don't change `src/` (the published engine).
- Stay on `main`. Don't commit. Leave the working tree dirty for human review.
- `npm run typecheck` must remain clean.

## When done

Report (under 250 words):

- For each finding: file modified, one-line description of the fix.
- New tests added (if any), and why they wouldn't have caught the bug before.
- Any follow-up implications (e.g. did F3 surface that another reader has the same fraction-vs-percent confusion? if so, flag it).
