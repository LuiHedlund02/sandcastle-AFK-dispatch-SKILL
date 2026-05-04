# Wave 4 — Cross-review of Waves 1–3 (top 5 moves)

## Goal

Independent review of the diff range `7a455b1..028ec30` (and one prior commit `fde84b0` for telemetry) covering the 5 vision-parity moves that just shipped. Find: regressions, type-safety gaps, accessibility issues, performance concerns, mockup-fidelity drifts that the implementing agents didn't flag in their own reports.

You're not implementing — you're reviewing. Don't change code unless the issue is trivial and unambiguous (a typo, a missed `prefers-reduced-motion` wrap on a single keyframe, a stray `console.log`). For anything more, **report it back as a finding**.

## What just shipped

| Commit    | Move                                     | Scope                                                                                                                                                                                                                                                                          |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fde84b0` | Telemetry honesty                        | `packages/control-core/src/telemetry/{TelemetryIndexer,ci/CiRateReader,issues/IssueCountReader}.ts` + tests                                                                                                                                                                    |
| `8679ba2` | Cockpit polish (CRT + kanji + chromatic) | `packages/screens/src/{chrome/AppChrome,routes/index}.tsx`, `packages/ui/src/fx/{ChromaticHeadline.module.css,KanjiWatermark.tsx,KanjiWatermark.module.css}`, `packages/ui/src/index.ts`                                                                                       |
| `d59f5c9` | Ceremony animations                      | `packages/ui/src/ceremony/{VictoryStage,DefeatStage}.{tsx,module.css}`, `packages/screens/src/routes/runs.$runId.{victory,defeat}.tsx`                                                                                                                                         |
| `7a455b1` | Operative 5-state reactivity             | `packages/screens/src/state/{operativeMicroState,useOperativeState,useFleetMicroStateMap,fleetStore}.ts`, `packages/screens/src/{index.ts,chrome/AppChrome.tsx}`, `packages/ui/src/{operative/ReactiveOperativeTile,fleet/{FleetDock,FleetDockCell}}.{tsx,module.css}` + tests |
| `028ec30` | Galaxy screen + climate derivation       | `packages/screens/src/routes/galaxy.tsx`, `packages/ui/src/galaxy/{GalaxySvgRenderer,climate}.ts(x)` + module.css + tests, route registration in apps                                                                                                                          |

## How to review

Run these in order:

```
git log --oneline fde84b0~1..HEAD
git diff fde84b0~1..HEAD --stat
git show <commit>   # for each of the 5 commits, read the actual diff
```

For each commit, hold the change against:

1. **The mockups it claims to copy from** (`docs/mockups/cockpit.html`, `victory.html`, `defeat.html`, `galaxy.html`). The agents claim "verbatim" copies of keyframes — verify a couple of them. Misquoted CSS values are real bugs.
2. **The implementation plan** (`docs/IMPLEMENTATION_PLAN.md`). Each move had a stated outcome — does the commit deliver?
3. **The protocol** (`packages/protocol/src/`). The frontend agents may have read fields in ways that don't match the schema (e.g. `coveragePct` is `number | null` — does the code handle null?).

## What to flag (priority order)

### Priority 1 — runtime / correctness

- Any place the operative micro-state machine could leak (decay timer never cleared, listener never unsubscribed).
- React `Maximum update depth` risks: zustand selector that returns a new object every render, useEffect deps that include unstable references.
- `null`/`undefined` field access without guards (especially the new climate derivation reading optional telemetry fields).
- Routing regressions: did adding `/galaxy` break any existing route's matcher order in `apps/{web,desktop}/src/routes.tsx`?

### Priority 2 — accessibility + reduced motion

- `prefers-reduced-motion` coverage. The Wave 2 + Wave 3 agents both claim to wrap keyframes in `@media (prefers-reduced-motion: no-preference)`. Spot-check a couple — any rule that applies translate/scale/rotate without that wrap is a regression.
- `aria-` semantics on the new ceremony stages and galaxy interactive elements (planet click target).
- Color-only state cues: the operative tile's 5 states currently differentiate by border color + box-shadow + animation. Reduced-motion users see only color — is that distinguishable for color-blind users? (No need to fix; flag if so.)

### Priority 3 — performance

- The galaxy route renders many planets with continuous CSS rotation. With ~140 planets in test data, is the FPS reasonable? You won't be able to measure, but you can spot-check whether each planet has its own keyframe instance vs. sharing.
- The fleetStore decay timer: how often does `tickMicroStates` re-arm? Does it run when no runs are active?

### Priority 4 — mockup fidelity drift

- Spot-check 3 keyframes claimed as verbatim copies from mockups.
- The kanji watermark text: did the agent use the cockpit-only string everywhere, or vary per-route? The dispatch said single global is fine.

### Priority 5 — code quality

- Dead code, unused imports, types declared but never used.
- Console logs left in.
- TODO comments and what they're guarding.

## What NOT to flag

- The pre-existing 3 unused-locals warnings in the engine (`src/Orchestrator.test.ts`, etc.) — out of scope.
- The Windows path normalization fixes from before this wave — already committed.
- The `apps/web/index.html` favicon 404 — cosmetic only, known issue.
- The `Maximum update depth exceeded` reported by the Wave 3 agent — I tested and it doesn't reproduce.

## Constraints

- **Don't run the test suite or boot servers** — the spawn EPERM with esbuild that prior Codex sessions hit on this machine will block you. Just read code.
- Don't change the protocol or backend semantics.
- Don't change `src/` (the published engine).
- Stay on `main`. Don't commit. If you fix something trivial, leave the working tree dirty so I can review.
- For non-trivial findings, write them up in this file under a `## Findings` section instead of fixing.

## Output

Add a section to **this file** (`.codex-run/wave4-review-dispatch.md`) titled `## Findings`. Each finding gets:

```
### Finding N — <one-line title>
- **Severity:** P1 / P2 / P3 / P4 / P5
- **Where:** file:line or commit
- **Issue:** what's wrong
- **Why it matters:** runtime impact / accessibility / mockup drift
- **Suggested fix:** one sentence
```

Plus a closing `## Verdict` paragraph: ship as-is / ship with the P1+P2 fixes / hold for follow-up.

Aim for ≤15 findings. If you have more than that, you're nitpicking — pick the ones that actually matter.

## Findings

### Finding 1 - Micro-state decay timer does not re-arm for later deadlines

- **Severity:** P1
- **Where:** packages/screens/src/state/fleetStore.ts:39 and packages/screens/src/state/fleetStore.ts:105
- **Issue:** `scheduleDecay` keeps only the earliest timer. When that timer fires, `tickMicroStates()` decays due entries but never schedules the next remaining `decayAt`, so a second run/state with a later deadline can stay stuck in `casting`, `striking`, `crit`, or `hit` until another run event happens.
- **Why it matters:** Multiple active runs can leave stale operative/dock visual state on screen; this is exactly the decay leak class called out in the dispatch.
- **Suggested fix:** After each tick, compute the next earliest non-null `decayAt` from the post-decay map and call `scheduleDecay` for it; also consider dropping terminal idle entries.

### Finding 2 - Fleet operative selector returns a fresh object under Zustand 5

- **Severity:** P1
- **Where:** packages/screens/src/state/useOperativeState.ts:19 and packages/screens/src/routes/fleet.tsx:777
- **Issue:** `useOperativeMicroStates()` passes a selector that constructs a new object every time and does not wrap it in `useShallow`; this differs from `useFleetMicroStateMap()`, which correctly uses shallow equality.
- **Why it matters:** With Zustand 5 / React 19, uncached selector snapshots can cause repeated rerenders and the `getSnapshot should be cached` / maximum-depth failure mode, especially on the fleet route where the hook is used directly.
- **Suggested fix:** Implement `useOperativeMicroStates()` with `useShallow`, or reuse an exported selector plus shallow equality so unchanged operative state maps keep stable snapshots.

### Finding 3 - Galaxy treats CI rate as both a fraction and a raw percent

- **Severity:** P1
- **Where:** packages/control-core/src/telemetry/ci/CiRateReader.ts:43, packages/ui/src/galaxy/climate.ts:29, packages/screens/src/routes/galaxy.tsx:698
- **Issue:** `readGitHubCiRate()` returns raw percents such as `50`, while `planetClimate()` compares CI against `0.85` and the galaxy panel renders `ciGreenRate30d * 100`. A repo with 50% CI can be classified as `clear`, and the panel can show `5000 %`.
- **Why it matters:** This corrupts the new climate derivation and selected-planet telemetry display.
- **Suggested fix:** Standardize `ciGreenRate30d` to either 0..1 or 0..100 at the protocol boundary, then update climate/display helpers and tests for both 50% and 95% cases.

### Finding 4 - Planet buttons suppress visible keyboard focus inside an image-role SVG

- **Severity:** P2
- **Where:** packages/ui/src/galaxy/GalaxySvgRenderer.tsx:84 and packages/ui/src/galaxy/GalaxySvgRenderer.tsx:388
- **Issue:** The outer `<svg>` is `role="img"` while child planet `<g>` nodes are focusable `role="button"` controls, and those controls set `outline: "none"` without a replacement focus style.
- **Why it matters:** Keyboard and assistive-tech users can have trouble discovering or tracking the interactive planet target, even though Enter/Space handlers exist.
- **Suggested fix:** Make the SVG a labelled group/list of interactive planets instead of a single image, and add a visible `:focus-visible` treatment for focused planet nodes.

### Finding 5 - Fleet dock micro-state is color/animation-only for reduced-motion users

- **Severity:** P2
- **Where:** packages/ui/src/fleet/FleetDockCell.tsx:61 and packages/ui/src/fleet/FleetDock.module.css:283
- **Issue:** `data-state` drives transient states through border/avatar color, box-shadow, and animation, but the accessible label only includes run status and directive. Under `prefers-reduced-motion: reduce`, the animation cue is removed, leaving mostly color/glow.
- **Why it matters:** The implementation plan explicitly requires no critical state conveyed by color alone; dock users will miss casting/striking/crit/hit state changes unless they can perceive the colors.
- **Suggested fix:** Include the micro-state in the cell label and add a non-color visual/text cue, such as a compact state token or icon pattern that remains visible with reduced motion.

### Finding 6 - Galaxy labels are not actually counter-rotated

- **Severity:** P4
- **Where:** packages/ui/src/galaxy/GalaxySvgRenderer.tsx:405 and packages/ui/src/galaxy/GalaxySvgRenderer.tsx:476
- **Issue:** The comment says labels stay upright, but only the body circles live inside `.bodyCounter`; the label `<text>` nodes are siblings outside that counter-rotating group, so they inherit the parent ring rotation.
- **Why it matters:** Planet names rotate around the orbit instead of staying readable, drifting from the mockup's static absolute-position labels and from the renderer's own stated behavior.
- **Suggested fix:** Move labels into a counter-rotating group or apply the same opposite-period transform to label nodes.

### Finding 7 - Galaxy uses one continuous counter-rotation animation per planet

- **Severity:** P3
- **Where:** packages/ui/src/galaxy/GalaxySvgRenderer.module.css:28 and packages/ui/src/galaxy/GalaxySvgRenderer.tsx:167
- **Issue:** The renderer has four ring animations, but every planet also gets its own `.bodyCounter` continuous animation. With the dispatch's ~140-planet data set, that is roughly 140 additional always-running animations before storm/selected/transit effects.
- **Why it matters:** This is likely to cost FPS/battery on the galaxy screen, and it scales linearly with planet count.
- **Suggested fix:** Prefer a static planet body/label layout, or counter-rotate only the minimal readable label layer and gate nonessential animation behind viewport/count thresholds.

### Finding 8 - Open issue telemetry counts pull requests as issues

- **Severity:** P3
- **Where:** packages/control-core/src/telemetry/issues/IssueCountReader.ts:27
- **Issue:** GitHub's `/repos/:owner/:repo/issues` endpoint includes pull requests, but the reader treats the total as open issues. The fallback removal made telemetry more honest when unavailable, but this source still inflates hostiles for repos with open PRs.
- **Why it matters:** The galaxy `storm` climate and selected-planet "Hostiles" panel can report false issue counts.
- **Suggested fix:** Use GitHub search with `is:issue is:open repo:owner/name`, or fetch/filter `pull_request` entries with pagination-aware counting.

### Finding 9 - Transit filter is a no-op but still subscribes to micro-state changes

- **Severity:** P5
- **Where:** packages/screens/src/routes/galaxy.tsx:149
- **Issue:** `.filter((r) => microStateByRunId[r.id] !== undefined || true)` always returns true, and the `useMemo` depends on `microStateByRunId` even though the filter cannot affect output.
- **Why it matters:** It is dead code and causes transit recomputation on every micro-state map update.
- **Suggested fix:** Remove the filter and dependency, or make the filter express the intended in-flight/micro-state rule.

## Verdict

Ship with the P1 and P2 fixes before calling Wave 4 done. I did not run tests or boot servers per the dispatch; this review is based on reading the diffs, mockups, plan, and protocol/code paths.
