# Phase 6 — Hosted-Web Transport Extraction Dispatch

You are an Opus 4.7 subagent dispatched by the parent Claude session for Sandcastle Phase 6: **prove the architecture is not Electron-locked**. Phase 0–5 are committed. Your scope: extract the transport layer out of `apps/desktop/src/api/` into a shared package, build a stub `apps/web/` app that uses the same UI bundle pointing at a remote control server, and add regression tests guarding the public API and transport parity.

## Read first (in this order)

1. `docs/IMPLEMENTATION_PLAN.md` §7 Phase 6.
2. `apps/desktop/src/api/{client,ws,queries}.ts` — the existing transport code, currently hard-coded to `window.sandcastle`.
3. `apps/desktop/electron/{main,preload}.ts` — the supervisor pattern that injects `port` + `token` via contextBridge.
4. `apps/desktop/src/AppChrome.tsx` and one screen route (e.g. `runs.$runId.cockpit.tsx`) — to understand how the API client + queries are consumed.
5. `packages/protocol/src/{api,ws}.ts` — the wire shapes both transports speak.
6. `git log --oneline -10` — commit message style.

## Outcome

1. **`packages/transport/`** new internal workspace housing the transport-neutral renderer foundation:
   - `apiClient` factory taking a `SandcastleConnection`-like config, returning the same shape as today's `apiClient`.
   - `connectFleetSocket` factory, same.
   - `TransportProvider` React context + `useTransport()` hook surfacing the api client + ws connector to consumers.
   - `useApiClient()` / `useFleetSocket()` hooks.
2. **Desktop migrated** to consume `@sandcastle/transport`. The Electron supervisor still owns connection acquisition; it now passes the connection via `TransportProvider` at the React root rather than the renderer reading `window.sandcastle` directly. The `window.sandcastle` global stays (preload still exposes it) so the `TransportProvider` can read it once and hand it down.
3. **`apps/web/`** new internal workspace — Vite project mirroring `apps/desktop/src/` minus the Electron supervisor. Loads from a `?endpoint=<base-url>&token=<token>` query string for v1 (a "set endpoint" prompt screen if the URL is missing). Same screens, same primitives, same TanStack/Zustand stores. Boots with `npm run dev:web`.
4. **Transport parity test** — a vitest suite that boots a real control-core (using the existing test helpers), then exercises the same query against both an "in-process" client (the existing per-test `startServer` pattern) and an "over-network" client (fetch via the spawned port). Asserts shape equality.
5. **Public API regression test** at `packages/control-core/test/regressions/public-api.test.ts`: does the equivalent of `npm pack --dry-run` and asserts the file count is exactly 222. Pin the count via a constant the test exports so future changes are explicit.

## Hard rules

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files.
- **No edits under** `src/`, `packages/control-core/src/`, or `packages/protocol/`. The control server is already transport-clean. Test files under `packages/control-core/test/` are fair game (regression test).
- **`packages/ui/` extensions must be additive.** The transport hooks live in `packages/transport/`, NOT in `packages/ui/` — UI primitives stay presentational.
- **Desktop must keep working unchanged.** The cockpit golden path (deploy → timeline → cancel) and all 5 Phase 1 screens render exactly the same.
- **`apps/web/` does not need feature parity with desktop.** v1 ships the cockpit + fleet routes; the rest can render placeholders or reuse the desktop routes if they're transport-agnostic.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Do not commit.** Leave the working tree dirty.

## Layout to add / modify

```
packages/transport/                       # NEW workspace
  package.json                            # name: @sandcastle/transport, peerDeps: react, react-dom, @tanstack/react-query, zustand
  tsconfig.json + tsconfig.build.json
  vitest.config.ts
  src/
    index.ts                              # barrel
    SandcastleConnection.ts               # { baseUrl: string; token: string } (note: baseUrl, not port)
    apiClient.ts                          # extracted + factory(connection)
    ws.ts                                 # extracted + factory(connection)
    TransportProvider.tsx                 # React context
    hooks.ts                              # useTransport, useApiClient, useFleetSocket
  test/
    apiClient.test.ts                     # smoke (mocked fetch)
    TransportProvider.test.tsx            # provides client to children

apps/desktop/                             # MODIFY
  src/
    api/client.ts                         # DELETE — replaced by transport package
    api/queries.ts                        # MODIFY — uses useApiClient() from transport
    api/ws.ts                             # DELETE — replaced
    main.tsx                              # MODIFY — wraps router in <TransportProvider connection={...}>
    AppChrome.tsx                         # MODIFY — consumes useApiClient() / useFleetSocket() instead of imported singleton

apps/web/                                 # NEW workspace
  package.json                            # name: @sandcastle/web, vite + react
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx                              # entry; reads ?endpoint= + ?token= from URL or shows a "Connect" form
    ConnectScreen.tsx                     # minimal endpoint/token entry form (no auth, no persistence — paste a token)
    routes.tsx                            # reuses cockpit + fleet routes from apps/desktop where possible (or duplicates a thin slice for v1)
    styles.css                            # imports @sandcastle/ui/tokens.css
  README.md                               # explains how to point at a remote control server

packages/control-core/test/regressions/
  public-api.test.ts                      # NEW — 222-file pin
  transport-parity.test.ts                # NEW — same query, two transports, identical shape
```

## What "done" means in detail

### `@sandcastle/transport`

- `SandcastleConnection` is `{ baseUrl: string; token: string }` (a fully-qualified URL — `http://127.0.0.1:NNNN` for desktop, `https://hosted.example.com` for web). The desktop adapter constructs `baseUrl` from `window.sandcastle.port`. The web adapter takes it as input.
- `apiClient(connection)` returns the same object shape as today's `apiClient` singleton — every method on it (`getFleet`, `createRun`, `decideRun`, `mergeAllGreen`, `parseQuestForge`, `engageQuestForge`, `getActivity`, `getOperativeXp`, etc.) is a direct port. No methods removed.
- `connectFleetSocket(connection, onMessage)` is the existing function with `port` replaced by `baseUrl` + the WS scheme derived (`http://` → `ws://`, `https://` → `wss://`).
- `TransportProvider` takes `connection: SandcastleConnection` and provides a memoized `apiClient` + ws connector to descendants.

### Desktop migration

- `apps/desktop/src/main.tsx` reads `window.sandcastle.{port, token}`, builds `connection = { baseUrl: \`http://127.0.0.1:${port}\`, token }`, wraps the router in `<TransportProvider connection={connection}>`.
- `AppChrome.tsx` and the route files swap `import { apiClient } from "./api/client"` for `const apiClient = useApiClient()`. Same for `connectFleetSocket`.
- `apps/desktop/src/api/queries.ts` becomes a wrapper around `useApiClient()` — TanStack hooks call into the per-render apiClient instead of a module-level singleton.

### Web app

- `npm run dev:web` boots Vite at e.g. `http://localhost:5174`.
- If `?endpoint=<base>&token=<t>` is in the URL, render the routes directly with that connection.
- Otherwise render `<ConnectScreen>` — a minimal form: "Endpoint URL" + "Bearer token" + Connect button. On submit, navigate to `/?endpoint=<base>&token=<t>`. No persistence in v1.
- Routes available in v1: `/runs/:runId/cockpit` and `/fleet`. Other routes can render a "not in v1 web build" placeholder or be omitted from `routes.tsx`.
- The web build must respect CORS for the control server. The control server already permits the bearer token to be passed; if CORS headers need adding, **stop and report** — don't silently change `packages/control-core/src/server.ts` (out of scope).

### Tests

- `packages/control-core/test/regressions/public-api.test.ts`:
  ```ts
  const PUBLIC_API_FILE_COUNT = 222 as const;
  it("public API file count is pinned at 222", () => {
    const result = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: /* repo root */, encoding: "utf8" });
    const parsed = JSON.parse(result);
    expect(parsed[0].entryCount).toBe(PUBLIC_API_FILE_COUNT);
  });
  ```
  Note: `npm pack --json` produces a JSON array even with `--dry-run`. If the runtime sandbox can't run npm, mark the test `it.skip` with a comment and document.
- `packages/control-core/test/regressions/transport-parity.test.ts`:
  - Boots a real control-core via `startServer({ ...isolatedDeps(makeRepo()) })`.
  - Builds two `apiClient`s — one pointing at `http://127.0.0.1:<port>` (the "over-network" path), and one constructed via the same factory but using a different fetch instance to prove the factory is hermetic.
  - Calls `getFleet` / `getRepo` from both, asserts identical shape.

### Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/protocol`: green
- [ ] `npm test -w @sandcastle/control-core`: green (existing 133 + your new regressions)
- [ ] `npm test -w @sandcastle/transport`: green
- [ ] `npm test -w @sandcastle/ui`: still 77 passing
- [ ] `npm run build -w @sandcastle/desktop`: green
- [ ] `npm run build -w @sandcastle/web`: green
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] `npm run dev:desktop` boots and the cockpit screen still works (the migration didn't break it)
- [ ] `npm run dev:web` boots; `ConnectScreen` renders; if you have a running control-core, you can connect and see fleet data — say so explicitly if you can't run two services

## Open decisions you may resolve

1. **`apps/web/` route surface in v1**: cockpit + fleet only is fine. Document the rest as Phase 7+ in the web app README.
2. **CORS**: the control server allows arbitrary origins via the bearer-token gate. If the browser refuses cross-origin without explicit CORS headers, flag and stop — don't change control-core in this dispatch.
3. **Transport package public surface**: re-export `SandcastleConnection`, the factories, and the React hooks. Don't expose internals.
4. **Web build target**: ESM-only output is fine. Tailwind + CSS Modules same as desktop.
5. **Token security**: pasting a bearer token into a URL is fine for v1 (proof of architecture). Phase 7+ would add proper auth.

## Deliverable

Working tree dirty:

- `packages/transport/` populated
- `apps/desktop/` migrated
- `apps/web/` populated
- `packages/control-core/test/regressions/` populated
- `package.json` root: workspace + `dev:web` script
- `.changeset/phase-6-transport.md` patch entry

Report:

1. File tree (added / modified / deleted)
2. Verification results per check above
3. Any deviations or open items with reason
