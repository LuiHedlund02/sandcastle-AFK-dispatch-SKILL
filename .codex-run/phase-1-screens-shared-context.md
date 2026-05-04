# Phase 1 — Screens Shared Context

You are one of 5 Opus 4.7 subagents building Phase 1 read-only screens in parallel for Sandcastle. The visual primitives library `@sandcastle/ui` already shipped (committed to disk in this working tree). You compose those primitives into a route under `apps/desktop/src/routes/`.

## Read first

1. `docs/IMPLEMENTATION_PLAN.md` §7 (Phase 1) — outcome you contribute to
2. `docs/mockups/<your-screen>.html` — the visual ground truth for _your_ screen
3. `packages/ui/src/index.ts` — your only allowed component import root
4. `packages/protocol/src/state.ts` + `api.ts` — types you consume
5. `apps/desktop/src/api/queries.ts` — existing TanStack Query hooks; you'll likely add new ones
6. `apps/desktop/src/state/fleetStore.ts` — Zustand projection store
7. `apps/desktop/src/routes.tsx` — register your route here

## Hard rules (apply to all 5 screen subagents)

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files.
- **No edits under** `src/`, `packages/control-core/`, `packages/protocol/`, or `packages/ui/`.
- **All visuals come from `@sandcastle/ui`.** If a mockup needs a primitive that doesn't exist, **stop and report** — do not inline-build it. Other subagents are watching the same boundary; one screen inventing a primitive breaks the whole library.
- **Read-only screens.** No mutations. The deploy chord (which mutates) lives in AppChrome, not in your screen.
- **TanStack Query for HTTP**, Zustand `useFleetStore` for live snapshots. You may add new query hooks in `apps/desktop/src/api/queries.ts` only if your screen needs an endpoint that doesn't have one.
- **Loading + error + empty states** for every fetched resource. Use the same pattern as `apps/desktop/src/routes/runs.$runId.cockpit.tsx`.
- **Keyboard accessibility**: skip nav, focusable interactive elements, visible focus rings. Reduced-motion already handled by primitives.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Workspace deps**: `"*"`, never `workspace:*`.
- **Do not commit.** Leave the working tree dirty.

## Coordination

Multiple screen subagents are running in parallel. To minimize merge conflicts:

- **Only edit** your screen file (e.g. `apps/desktop/src/routes/fleet.tsx`) and add at most one route registration line in `apps/desktop/src/routes.tsx`.
- **Add at most one query hook** per screen to `apps/desktop/src/api/queries.ts`. Use a stable hook name like `useFleet`, `useRoster`, `usePlanetById(id)`, `useOperative(id)` so other subagents can reuse.
- **Do not move imports** in `routes.tsx`. Add your route as the last child of the catch-all parent.
- **Do not modify `AppChrome`** — it's the shared shell.
- **Do not add packages** without flagging them. If you need `markdown-to-jsx` for card body rendering, mention it in your report and I'll consolidate across screens.

## Backend endpoints available

- `GET /repos` → `{ repos: RegisteredRepo[] }`
- `GET /repos/:id/deck` → `Deck`
- `GET /repos/:id/telemetry` → `RepoTelemetry`
- `GET /operatives` → `{ operatives: OperativeIdentity[] }`
- `GET /operatives/:id` → `OperativeIdentity & { repoRecord?: OperativeRepoRecord }`
- `GET /fleet` → `FleetState` (already used by Phase 0 cockpit)
- `GET /repo` → `{ root, branch }` (current repo)

The current repo's id is the first repo in `GET /repos`. For now Phase 1 treats the _current_ repo as the focus; multi-repo navigation across the dock is a Phase 2 concern.

## Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm run build -w @sandcastle/desktop`: green
- [ ] Boot `npm run dev:desktop`, navigate to your route, confirm it renders without crashing against a real control-core. If you can't run electron headfully, say so explicitly — do not claim success.

## Report shape

When done, report:

1. Files added/modified (file tree)
2. Any new query hook you added to `queries.ts`
3. Any deviation from the spec or open question
4. Verification results (typecheck output tail, screen render confirmation or unable-to-run note)
