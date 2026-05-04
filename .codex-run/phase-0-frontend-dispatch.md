# Phase 0 — Frontend Slice Dispatch

You are gpt-5.5 (Codex), dispatched by Claude (Opus 4.7) to build the frontend half of Phase 0 of Sandcastle's UX expansion. The backend half is already complete and merged on disk. Your job is the **Electron supervisor + Vite renderer + cockpit route** that talks to the existing control-core HTTP+WS server.

Read these first (do not skip):

1. `docs/IMPLEMENTATION_PLAN.md` — single source of truth for architecture and phases
2. `.codex-run/phase-0-dispatch.md` — the backend dispatch (already executed; gives you the contract you have to honor)
3. `packages/protocol/src/state.ts`, `events.ts`, `api.ts`, `ws.ts` — the typed boundary you use
4. `packages/control-core/src/cli.ts`, `server.ts` — what your supervisor spawns and what your renderer talks to
5. `docs/mockups/cockpit.html` — visual target (do not match pixel-perfect; capture intent)
6. `docs/mockups/index.html` — fleet dock + deploy chord patterns to extract as primitives

## What "done" means for Phase 0 frontend

User runs `npm run dev:desktop` and gets:

1. Electron window opens
2. Window shows a cockpit screen with persistent fleet dock (88px bottom bar, stub data OK) and ⌘D deploy chord overlay (handler bound, can be empty)
3. User can type a directive in a deploy panel, hit Deploy, and see one **real** sandcastle run kick off in the local repo
4. The cockpit timeline streams `tool.started` / `tool.finished` / `text` events live as the run progresses
5. User can hit Cancel; the run aborts; status flips to `aborted`
6. On completion, status flips to `victory` or `defeat`

That is the entire Phase 0 frontend deliverable. **Do not** build the other 11 routes. **Do not** match the mockups' full visual fidelity — primitives extracted, cyberpunk palette applied, but no scanline overlays, no chromatic aberration, no Framer Motion choreography. Phase 1 layers those on.

## Hard rules (will be checked)

- **No change to the public API of `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files; nothing under `apps/` or `packages/` may leak.
- **Renderer must not import from `@ai-hero/sandcastle` or any `src/` engine file.** Only `@sandcastle/protocol`. Verify with grep.
- **Supervisor parses the JSON line `{"port":N,"token":"...","pid":N}` from control-core stdout** — that is the handshake contract. Do not bypass it.
- **Auth:** WS uses `?token=...` query string. HTTP uses `Authorization: Bearer <token>`.
- **Workspace versions:** use `"*"` in package.json deps (npm 10 workspaces). Do NOT use `workspace:*` (npm rejects with EUNSUPPORTEDPROTOCOL).
- **Do not commit.** Leave the working tree dirty for review.
- **Do not modify** `packages/protocol/`, `packages/control-core/`, or any file under `src/` (the engine). If you need a change there, stop and report — do not silently change it.
- **TypeScript strict.** Run `npm run typecheck` from repo root and confirm green.
- **Windows host.** Paths use `path.resolve` and `path.join`. No POSIX-only assumptions.
- **No Tauri, no Next.js.** Electron + Vite + React only.

## Stack (locked by IMPLEMENTATION_PLAN §3)

- Electron (latest stable)
- electron-vite OR vite + electron-builder (you pick — electron-vite is simpler, fine)
- React 19
- React Router 7 (data router, file-based routes optional but not required for Phase 0)
- Zustand for live fleet state (subscribes to WS, projects to UI)
- TanStack Query for HTTP request/cache (POST /runs, POST /runs/:id/cancel, GET /runs/:id, GET /fleet)
- Tailwind v4
- CSS Modules for component-scoped styles where Tailwind is awkward (octagonal clip-path panels, etc.)
- No Framer Motion in Phase 0

## Layout to create

```
apps/desktop/
  package.json                         # name: @sandcastle/desktop, private, type: module
  electron-vite.config.ts              # or vite.config.ts + electron config
  tsconfig.json                        # extends repo root, strict
  index.html                           # vite entry
  electron/
    main.ts                            # supervisor: spawn control-core, parse JSON line, open BrowserWindow
    preload.ts                         # typed bridge (minimal — exposes port/token to renderer via contextBridge)
  src/
    main.tsx                           # React 19 entry
    routes.tsx                         # React Router config
    AppChrome.tsx                      # global shell: FleetDock + DeployChordOverlay slots
    api/
      client.ts                        # fetch wrapper with bearer auth; uses port/token from preload
      ws.ts                            # WebSocket client; reconnects with backoff; emits typed events
      queries.ts                       # TanStack Query hooks: useFleet, useRun, useCreateRun, useCancelRun
    state/
      fleetStore.ts                    # Zustand: subscribes to WS, projects FleetState
    routes/
      index.tsx                        # minimal landing — list runs, "Deploy" button → /runs/:id/cockpit
      runs.$runId.cockpit.tsx          # cockpit screen: directive header, timeline, status pill, cancel button
    primitives/
      FleetDock.tsx                    # 88px bottom bar; stub cells OK
      DeployChordOverlay.tsx           # ⌘D opens; textarea + Deploy button
      CockpitTimeline.tsx              # renders tool.started/finished/text events in order
      StatusPill.tsx                   # status colored chip
    styles/
      tokens.css                       # color/font tokens (warm void #03060a, cyan #50e3ff, magenta #ff4dd2, plasma green #4dffaa, amber #ffb84d, crimson #ff4d6d)
      globals.css                      # Tailwind directives + base
```

## Supervisor responsibilities (electron/main.ts)

1. On `app.whenReady`:
   a. Spawn `node` running `packages/control-core/dist/cli.js` (or `tsx packages/control-core/src/cli.ts` in dev) with `--port=0 --repo=<repo-root>`
   b. Read first line of stdout, parse as JSON `{ port, token, pid }`
   c. Pass `{ port, token }` to BrowserWindow via `additionalArguments` or by writing to a temp file the preload reads
   d. `BrowserWindow.loadURL(\`http://127.0.0.1:\${port}/?token=\${encodeURIComponent(token)}\`)` if you want server-served — OR — load the Vite dev server URL and pass port/token via contextBridge (preferred, simpler dev loop)
2. On `before-quit`: send SIGTERM to control-core child, await exit (max 2s), then force kill
3. Repo root resolution: `process.env.SANDCASTLE_REPO ?? process.cwd()` — but in dev, default to `path.resolve(__dirname, "../../..")` (the sandcastle repo itself)

## Preload (electron/preload.ts)

Minimal. Expose `window.sandcastle = { port: number; token: string }` via `contextBridge.exposeInMainWorld`. Nothing else. Renderer reads from `window.sandcastle` to build its API client base URL.

## Renderer flow

1. `main.tsx` boots React, mounts `<RouterProvider>`
2. `AppChrome` wraps every route, mounts `<FleetDock />` and `<DeployChordOverlay />`
3. App-level effect opens WS to `ws://127.0.0.1:${port}/?token=${token}`, sends `{ type: "subscribe", payload: {} }`, pipes incoming messages into Zustand fleet store
4. Cockpit route reads `useRun(runId)` (TanStack) and `useFleetStore(s => s.runEvents[runId])` (Zustand)
5. Deploy chord overlay calls `useCreateRun().mutate({ directive })` → on success, navigate to `/runs/:id/cockpit`
6. Cancel button calls `useCancelRun(runId).mutate()`

## What to test (you must verify before reporting done)

- [ ] `npm run typecheck` green from repo root
- [ ] `npm pack --dry-run` from repo root: still 222 files, nothing leaked
- [ ] grep: `apps/desktop/src/**` does not import `@ai-hero/sandcastle` or `../../src/`
- [ ] `npm run dev:desktop` boots Electron, window opens, cockpit visible
- [ ] DevTools Console: WS connects, fleet snapshot received
- [ ] Type a directive, hit Deploy, watch timeline stream events
- [ ] Cancel mid-run, status flips to `aborted` within 2s
- [ ] Let one run complete to victory, status flips correctly

For the runtime smoke test, you can use the playwright MCP tools or a manual check. **Do not skip the runtime smoke test.** Typecheck-green is necessary but not sufficient.

## Open questions you may resolve as you see fit

1. electron-vite vs vite+electron-builder — electron-vite is simpler, recommend
2. Tailwind v4 alpha vs stable — use stable v3 if v4 setup costs >30min; we're not in production yet
3. Deploy chord — `⌘D` on macOS, `Ctrl+D` on Win. Use `electron.globalShortcut` or in-renderer key listener? Renderer is fine for v0
4. Run list on landing — query `GET /runs` route doesn't exist yet on the backend; **stop and report** if you need it. For Phase 0 the deploy flow can simply navigate to the cockpit on success without a list
5. If you find a bug in the backend (control-core, protocol), **stop and report** — do not silently fix it. The backend is sealed for review.

## Deliverable

Working tree dirty with `apps/desktop/` populated, root `package.json` updated to include `apps/*` in `workspaces` and a `dev:desktop` script, and a `.changeset/phase-0-desktop.md` patch entry. Report:

1. What you built (file tree)
2. Verification results (typecheck output tail, npm pack count, grep results, smoke test outcome)
3. Any open items or deviations from this spec with reason
4. Any backend issues you noticed but did not touch
