# Web App Route Buildout Dispatch

You are an Opus 4.7 subagent dispatched by the parent Claude session to bring `apps/web/` to feature parity with `apps/desktop/`. Phase 0–6 + CORS are committed. Your scope: extract the shared route components into a `packages/screens/` workspace, register all routes in both apps, and verify both still work.

## Read first

1. `apps/desktop/src/routes/` — every existing screen. They already consume `useApiClient()` + `useFleetSocket()` from `@sandcastle/transport`, so they're transport-agnostic.
2. `apps/desktop/src/state/fleetStore.ts` — pure Zustand around protocol types; transport-agnostic.
3. `apps/desktop/src/api/queries.ts` — TanStack hooks consuming `useApiClient()`. Also transport-agnostic.
4. `apps/web/src/routes.tsx` — current placeholders.
5. `apps/web/src/styles.css` and `apps/desktop/src/styles/globals.css` — CSS the routes assume is loaded.

## Outcome

1. **`packages/screens/` new workspace** housing the shared route components, fleet store, and query hooks. Both apps import from there.
2. **`apps/desktop/`** migrated to consume the new package; cockpit golden path + all 7 Phase 1 screens still render exactly the same.
3. **`apps/web/`** registers all the routes from the shared package — `/planet/:planetId`, `/quest-forge`, `/runs/:runId/{combat,victory,defeat}`, `/roster`, `/operatives/:operativeId` — alongside the existing fleet + cockpit. Placeholder routes deleted.
4. The desktop's globals.css contains styles that some routes still depend on (`.cockpit-layout`, `.run-sidebar`, `.eyebrow`, etc.). Move those into a shared `packages/screens/src/styles/route-globals.css` and have both apps import it.

## Hard rules

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root still 222 files. The regression test will fail loudly if you break it.
- **No edits under** `src/`, `packages/control-core/src/`, `packages/protocol/`, or `packages/transport/`.
- **`packages/ui/` extensions stay additive.** No primitive APIs change.
- **Desktop must keep working unchanged.** Cockpit golden path (deploy → timeline → cancel) verified by Electron boot.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Do not commit.** Leave the working tree dirty.

## Layout to add / modify

```
packages/screens/                            # NEW
  package.json                               # @sandcastle/screens, peerDeps: react, react-router-dom, transport, ui, protocol
  tsconfig.json + tsconfig.build.json
  src/
    index.ts                                 # barrel
    state/fleetStore.ts                      # MOVE from apps/desktop/src/state/
    api/queries.ts                           # MOVE from apps/desktop/src/api/queries.ts
    routes/
      index.tsx                              # MOVE
      runs.$runId.cockpit.tsx                # MOVE
      runs.$runId.combat.tsx                 # MOVE
      runs.$runId.victory.tsx                # MOVE
      runs.$runId.defeat.tsx                 # MOVE
      fleet.tsx                              # MOVE
      planet.$planetId.tsx                   # MOVE
      quest-forge.tsx                        # MOVE
      roster.tsx                             # MOVE
      operatives.$operativeId.tsx            # MOVE
    chrome/AppChrome.tsx                     # MOVE the desktop AppChrome (it's not Electron-specific — preload-injection happens in main.tsx)
    styles/route-globals.css                 # NEW: extract route-specific CSS from desktop's globals.css

apps/desktop/                                # MODIFY
  package.json                               # add @sandcastle/screens
  src/
    main.tsx                                 # import AppChrome + router from @sandcastle/screens
    routes.tsx                               # imports route components from @sandcastle/screens
    styles/globals.css                       # remove the moved styles, keep desktop-only ones
    state/                                   # DELETE — moved to screens
    api/queries.ts                           # DELETE — moved to screens
    AppChrome.tsx                            # DELETE — moved to screens
    routes/                                  # DELETE — moved to screens

apps/web/                                    # MODIFY
  package.json                               # add @sandcastle/screens
  src/
    main.tsx                                 # imports AppChrome from @sandcastle/screens
    routes.tsx                               # registers all routes from @sandcastle/screens (no placeholders)
    routes/                                  # DELETE the two placeholder copies
    styles.css                               # imports @sandcastle/screens/route-globals.css
```

## What "done" means

- `apps/web/` and `apps/desktop/` both render the same set of routes from the same code.
- The Electron main.tsx is the only meaningful difference — it builds the connection from the supervisor handshake. The web's main.tsx reads connection from URL params.
- Both apps' `AppChrome` is now a single shared component; deploy chord, fleet dock, and decision-card flow work identically in both.

## Tests

No new tests required — the existing 77 ui tests + 135 control-core tests + 25 protocol tests + 5 transport tests cover everything. Run the full suite to confirm nothing broke.

## Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/protocol`: green
- [ ] `npm test -w @sandcastle/control-core`: green (the 222-file regression must still pass)
- [ ] `npm test -w @sandcastle/ui`: green
- [ ] `npm test -w @sandcastle/transport`: green
- [ ] `npm run build -w @sandcastle/desktop`: green
- [ ] `npm run build -w @sandcastle/web`: green
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] `npm run dev:desktop` boots — say so explicitly if you can't run it

## Open decisions you may resolve

1. **AppChrome split**: the desktop's AppChrome reads `useTransport().connection` and shows the host chip. That stays in the shared component. Anything truly Electron-specific (currently nothing in the file post-Phase 6 migration) gets moved to apps/desktop/main.tsx via composition.
2. **Cockpit ↔ combat link**: stays in the shared cockpit route — both apps benefit.
3. **`useFleetStore` migration**: it's a global Zustand store. Moving it to a shared package is fine — both apps mount one instance per renderer process anyway.

## Deliverable

Working tree dirty:

- `packages/screens/` populated
- `apps/desktop/` migrated (route files, AppChrome, queries, fleetStore moved out)
- `apps/web/` route registration filled out, placeholders removed
- Root `package.json` workspaces unchanged (apps/_ + packages/_ already covers it)
- `.changeset/web-routes-buildout.md` patch entry

Report:

1. File tree (added / moved / deleted)
2. Verification results
3. Any deviations or surprises (e.g. routes that depended on something genuinely Electron-specific you had to refactor)
