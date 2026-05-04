# Phase 4 — Frontend Slice Dispatch

You are an Opus 4.7 subagent dispatched by the parent Claude session for Sandcastle Phase 4 frontend work. The Phase 4 backend just committed (`0269deb protocol`, `c89949e control-core`). Your scope: **Victory and Defeat ceremony screens**, **real-data planet/map binding** (replacing Phase 1's placeholder telemetry hooks with live coverage / CI / issues / churn), and **XP delta / activity feed** surfaces.

## Read first (in this order)

1. `docs/IMPLEMENTATION_PLAN.md` §7 Phase 4 and §4 (XP rule).
2. `docs/mockups/victory.html` and `docs/mockups/defeat.html` — the ceremony visuals (cyberpunk celebration / consolation skin).
3. `docs/mockups/planet.html` and `docs/mockups/map.html` — planet biome + region monsters.
4. `apps/desktop/src/routes/planet.$planetId.tsx` — current Phase 1 telemetry rendering. You're filling in the now-non-null fields.
5. `packages/protocol/src/{state,events,api}.ts` — `RepoTelemetry` (no longer always-null), `zActivityEvent`, `zXpLedgerEntry`, `zOperativeXpSummary`, `xpDelta` on PostRunDecisionResponse, the new `/repos/:id/activity` and `/operatives/:id/xp` routes.
6. `apps/desktop/src/api/{client,queries}.ts` — extend with `getActivity`, `getOperativeXp`.
7. `packages/ui/src/index.ts` — barrel; you'll add new exports for ceremony + activity primitives.
8. `apps/desktop/src/AppChrome.tsx` — for surfacing `xpDelta` in the merge confirmation toast.

## Outcome (what "done" means)

User can:

1. **See real telemetry** on the planet screen: coveragePct / ciGreenRate30d / openIssues / churnScore actually populate (when the backend can compute them). The Phase 1 `null` fallbacks remain honest — show "—" or "no signal" rather than fake numbers.
2. **Open Victory or Defeat ceremony** by clicking a victory/defeat dock cell. Ceremony pulls run data, phases, verifyResults, and `xpDelta` (from the merge response or the operative's XP summary). Defeat surfaces the failed checks honestly.
3. **See an activity feed** on the planet screen — a small "Recent activity" panel that lists the last ~10 `ActivityEvent`s for the planet's repo (run.started, tool.called, run.resolved with xpDelta, etc.).
4. **See the operative's XP** on the operative dossier — totalXp, recent merge entries with xpDelta and "(reverted)" badge when revertedAt is set.
5. **See "+500 XP" toast** in the merge confirmation when `useDecideRun` returns a positive xpDelta.

That's the entire deliverable. Do not retouch unrelated Phase 1 chrome.

## Hard rules

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files.
- **No edits under** `src/`, `packages/control-core/`, or `packages/protocol/`.
- **`packages/ui/` extensions must be additive.**
- **Honest empty states** — when telemetry is `null` (no GitHub remote, no coverage report, etc.), render "—" or a textual "no signal" hint, never zero/fake values.
- **Reduced motion / high contrast guards** apply to ceremony confetti / spotlight effects.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Do not commit.** Leave the working tree dirty.

## What to build

### 1. Ceremony primitives (`packages/ui/src/ceremony/`)

- `VictoryStage.tsx` — celebration layout: hero portrait, planet thumbnail, big "VICTORY" headline, XP delta callout, phases-merged-summary, merge SHA, "Back to fleet" / "Open cockpit" actions. Wraps in `OctaPanel` tone="plasma".
- `DefeatStage.tsx` — consolation layout: hero portrait, planet thumbnail, "DEFEAT" headline, failed-checks list, scars-earned-here count, "Revise" / "Discard" / "Back to fleet" actions. `OctaPanel` tone="amber" or "crimson".
- `XpDeltaBadge.tsx` — animated +N XP chip; `prefers-reduced-motion` static fallback.
- `ConfettiSpray.tsx` — pure CSS confetti burst. Static fallback under reduced motion.
- `ActivityFeed.tsx` — vertical list of `ActivityEvent`s with timestamps and event-type-specific glyphs.

### 2. Telemetry/XP UI helpers (`packages/ui/src/telemetry/`)

- `TelemetryGrid.tsx` — extracted from the Phase 1 inline grid. Takes a `RepoTelemetry` and renders 8 cells (branch / age / coverage / CI / issues / tests / churn / lastCommit), each with a `null`-safe formatter that outputs "—" + a faint "no signal" tooltip when the value is null.
- `OperativeXpStrip.tsx` — totalXp + spark-bar of recent merges, with reverted entries grayed.

### 3. Desktop wiring (`apps/desktop/src/`)

- `api/client.ts`: add `getActivity(repoId, limit?)` and `getOperativeXp(operativeId)`.
- `api/queries.ts`: add `useActivity(repoId, limit=10)` and `useOperativeXp(operativeId)`.
- `routes/planet.$planetId.tsx`: replace the Phase 1 inline telemetry grid with `<TelemetryGrid telemetry={...} />`. Append a "Recent activity" `<OctaPanel>` rendering `<ActivityFeed events={activity} limit={10} />`.
- `routes/runs.$runId.victory.tsx`: NEW route. Reads run + phases + xp from `useFleetStore` + queries. Composes `<VictoryStage>`. Add a route entry in `routes.tsx`.
- `routes/runs.$runId.defeat.tsx`: NEW route. Same shape, defeat skin.
- `routes/operatives.$operativeId.tsx`: append `<OperativeXpStrip operativeXp={...} />` below the existing dossier panel.
- The dock-cell decision card from Phase 2: make the "win-pending → merge confirm" path navigate to `/runs/:id/victory` after success (not the cockpit). Same for fail-pending → `/runs/:id/defeat`. The existing decision card stays — this just adds the post-decision navigation.
- AppChrome merge toast: when `useDecideRun` returns `xpDelta > 0`, show a brief "+N XP" toast or banner. Reuse the existing inline error/notice slot if there is one; otherwise add a minimal toast.

## Tests

```
packages/ui/test/
  ceremony/VictoryStage.test.tsx
    - renders headline, xp delta, merged-phases summary
    - reduced-motion path hides confetti
  ceremony/DefeatStage.test.tsx
    - renders headline + failed-checks list + revise/discard buttons
  ceremony/ActivityFeed.test.tsx
    - renders N events with the right glyphs per type
    - empty state when events is empty
  telemetry/TelemetryGrid.test.tsx
    - null fields render "—" rather than 0
    - non-null coverage renders as N% with one decimal
```

## Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/ui`: existing 61 + your new ones all pass
- [ ] `npm run build -w @sandcastle/desktop`: green
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] If you can boot Electron: `npm run dev:desktop` and confirm the planet screen shows real telemetry where available. Otherwise say so explicitly.

## Open decisions you may resolve

1. **Ceremony entry**: dock-cell-click only (per IMPLEMENTATION_PLAN — "opt-in"). Do not auto-navigate when a run resolves.
2. **Confetti**: pure CSS keyframes, ~12 confetti elements, ~2s duration. Reduced-motion fallback shows static colored dots.
3. **Activity feed limit**: default 10 on the planet screen, 50 max from the API. Don't paginate — Phase 5+ if needed.
4. **XP toast position**: top-right corner inside the AppChrome titlebar slot is fine for v1.

## Deliverable

Working tree dirty:

- `packages/ui/src/ceremony/` new
- `packages/ui/src/telemetry/` new
- `packages/ui/src/index.ts` re-exports
- `packages/ui/test/{ceremony,telemetry}/` new
- `apps/desktop/src/api/{client,queries}.ts` extended
- `apps/desktop/src/routes.tsx` registers `/runs/:runId/{victory,defeat}`
- `apps/desktop/src/routes/runs.$runId.{victory,defeat}.tsx` new
- `apps/desktop/src/routes/{planet.$planetId,operatives.$operativeId}.tsx` extended
- `apps/desktop/src/AppChrome.tsx` xp-toast wiring
- `.changeset/phase-4-frontend.md` patch entry

Report:

1. File tree (added / modified)
2. Verification results (typecheck output tail, test pass counts, npm pack count, smoke test outcome or unable-to-run note)
3. Any deviations or open items with reason
