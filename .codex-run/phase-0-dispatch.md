# Sandcastle — Phase 0 Backend Dispatch

You are the backend engineer building the first slice of a major UX expansion of the Sandcastle TypeScript CLI library. You will work to a tight scope and a strict completeness contract. The frontend (Electron supervisor + Vite/React renderer) is being built in parallel by Claude — your job is everything from the engine through the control-process WebSocket boundary.

## Read these documents first, in order

1. `docs/IMPLEMENTATION_PLAN.md` — the locked plan from three independent reviews. Read all 12 sections; you will follow it exactly.
2. `.codex-run/dispatch-prompt.md` — original brief (existing engine, mockups, conceptual model).
3. `.codex-run/codex-plan-final.md` — earlier consolidated plan (superseded by `docs/IMPLEMENTATION_PLAN.md`; read for context only).
4. The actual engine source you will be touching:
   - `src/AgentStreamEmitter.ts` (you WILL widen this)
   - `src/run.ts` (you will read; you may add an internal-only event hook surface — DO NOT change the public `run()` signature)
   - `src/Orchestrator.ts`
   - `src/WorktreeManager.ts` (Phase 2 will add `RepoRunCoordinator`; Phase 0 only needs `runId`-based naming hooks, see below)
   - `src/SandboxLifecycle.ts`
   - `src/index.ts` (public API surface; treat as frozen)

## What's locked (from `docs/IMPLEMENTATION_PLAN.md` §1)

You do not relitigate any of these. Build exactly to them.

| #   | Decision                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Separate Node control process. HTTP/WebSocket from day 1. Electron is supervisor only. Random port on 127.0.0.1 with ephemeral token.                                 |
| 2   | Operative state: split-state hybrid. **Identity** at `~/.sandcastle/operatives/<id>.json`. **Per-project record** at `<repo>/.sandcastle/state/operatives.<id>.json`. |
| 3   | Telemetry storage: SQLite at `<repo>/.sandcastle/state/sandcastle.sqlite` via `better-sqlite3`.                                                                       |
| 4   | IPC cadence: semantic events over WebSocket; renderer applies at RAF; text deltas batched per-run at ~30Hz; critical state transitions flush immediately.             |
| 5   | Stack: TS + Effect (engine) → control-core (new) → HTTP/WS protocol → React UI (handled by Claude).                                                                   |
| 6   | Phase 0 deliverable: Cockpit MVP — one repo, one real run, end-to-end, with cancellation.                                                                             |
| 7   | Engine prerequisite: widen `AgentStreamEmitter` (additive only — do NOT break the public `AgentStreamEvent` type).                                                    |
| 8   | Accessibility: handled in renderer; you don't touch it.                                                                                                               |

## What you will deliver in this dispatch

A coordinated set of changes that ends with: **the control-core boots a local server on `127.0.0.1:<port>` with an ephemeral token, opens a WebSocket channel, accepts an HTTP `POST /runs` to start a real `run()`, streams typed events to the WebSocket, accepts `POST /runs/:id/cancel` to abort, and persists run state to SQLite. No UI yet — Claude is building that separately.**

You produce three things, all under the existing repo:

### Deliverable A — Widen `AgentStreamEmitter` (additive, non-breaking)

In `src/AgentStreamEmitter.ts`, extend `AgentStreamEvent` with new event variants. **You may NOT modify the existing two variants (`text`, `toolCall`) or change the public `AgentStreamEvent` exported type's old fields. Add new variants only.**

New variants to add (each carries `iteration: number` and `timestamp: Date` like the existing two):

```ts
| { readonly type: "run.started";          readonly runId: string; readonly directive: string; readonly branch: string; readonly worktreePath?: string; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "run.statusChanged";    readonly runId: string; readonly from: RunStatus; readonly to: RunStatus; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "tool.started";         readonly name: string; readonly formattedArgs: string; readonly toolCallId: string; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "tool.finished";        readonly name: string; readonly toolCallId: string; readonly durationMs: number; readonly ok: boolean; readonly output?: string; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "verification.started"; readonly checks: readonly string[]; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "verification.finished";readonly allGreen: boolean; readonly failedChecks: readonly string[]; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "decision.required";    readonly kind: "merge" | "revise" | "discard"; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "run.resolved";         readonly runId: string; readonly result: "victory" | "defeat" | "aborted"; readonly xpDelta: number; readonly iteration: number; readonly timestamp: Date }
| { readonly type: "intervention.used";    readonly action: string; readonly iteration: number; readonly timestamp: Date };
```

`RunStatus` is a string-literal union: `"queued" | "starting" | "casting" | "striking" | "verifying" | "win-pending" | "fail-pending" | "victory" | "defeat" | "aborted"`. Define and export it from `AgentStreamEmitter.ts`.

You do NOT need to make every existing engine call site emit every new event in this dispatch. Only ensure the type surface is widened so control-core can subscribe to all of them. Wire emission for at least:

- `run.started` (from `run.ts` startup)
- `run.statusChanged` (`starting` → `casting` when first tool/text arrives)
- `tool.started` and `tool.finished` (alongside the existing `toolCall` event — emit both during the transition; the old `toolCall` event remains for backward compat)
- `run.resolved` (from `run.ts` completion path; map `IterationResult` outcomes to `victory` | `defeat` | `aborted`)

Other variants (`verification.*`, `decision.required`, `intervention.used`) can be defined now and emitted in later phases. Make them callable through the emitter so control-core can synthesize them too.

Add comprehensive vitest coverage in `src/AgentStreamEmitter.test.ts` (extending the existing test file if any). Each new variant must round-trip through `callbackAgentStreamEmitterLayer` cleanly.

**Public API constraint:** `src/index.ts` re-exports `AgentStreamEvent`. Do not break that. If you need to export `RunStatus`, export it the same way.

### Deliverable B — `packages/protocol`

A new internal package, not published. Lives at `packages/protocol/`.

**`package.json`:**

```json
{
  "name": "@sandcastle/protocol",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsgo --project tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsgo --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

**Files to produce** (TypeScript, ES modules, strict):

- `src/index.ts` — re-exports everything below
- `src/state.ts` — TypeScript types + zod schemas for: `ProviderId`, `CardType`, `RunStatus`, `OperativeMicroState`, `Card`, `Deck`, `OperativeIdentity`, `OperativeRepoRecord`, `Planet`, `Phase`, `Run`, `FleetState`. Copy the shapes from `docs/IMPLEMENTATION_PLAN.md` §3 verbatim, then add zod schemas (`zCard`, `zDeck`, etc.) that parse them.
- `src/events.ts` — `RunEvent` type + zod schema. The variants must align 1:1 with the new `AgentStreamEvent` variants from Deliverable A, plus the older `text` / `toolCall` variants.
- `src/api.ts` — HTTP route shapes:
  - `POST /runs` request body + response (start a run; returns `{ runId }`)
  - `POST /runs/:id/cancel` request + response
  - `GET /runs/:id` returns the current `Run` snapshot
  - `GET /fleet` returns `FleetState`
  - `GET /repo` returns `{ root: string; branch: string }`
- `src/ws.ts` — WebSocket message envelope:
  ```ts
  type WsServerMessage =
    | { type: "hello"; payload: { sessionId: string; serverVersion: string } }
    | { type: "fleet.snapshot"; payload: FleetState }
    | { type: "run.event"; runId: string; event: RunEvent }
    | { type: "error"; payload: { code: string; message: string } };
  type WsClientMessage =
    | { type: "subscribe"; payload: { runId?: string } }
    | { type: "ping" };
  ```
- `tsconfig.json` extending the repo's base config; emit ESM to `dist/`.
- `tsconfig.build.json` for builds.
- `vitest.config.ts` with `passWithNoTests: false`.
- `test/state.test.ts` — verify all zod schemas round-trip the example fixtures.
- `test/events.test.ts` — every `RunEvent` variant parses; rejection cases for malformed input.

**Public API constraint:** This package is internal. It must not be added to `package.json` workspaces in a way that publishes it to npm. The root `package.json` `files` array is currently `["dist"]`; adding a workspace must not change what npm publishes.

### Deliverable C — `packages/control-core`

The Node + Effect server. Lives at `packages/control-core/`.

**`package.json`:**

```json
{
  "name": "@sandcastle/control-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "sandcastle-control": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsgo --project tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsgo --noEmit",
    "dev": "tsx src/cli.ts"
  },
  "dependencies": {
    "@sandcastle/protocol": "workspace:*",
    "@ai-hero/sandcastle": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "effect": "^3.20.0",
    "@effect/platform": "^0.95.0",
    "@effect/platform-node": "^0.105.0",
    "ws": "^8.18.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/ws": "^8.5.0"
  }
}
```

**Files to produce:**

- `src/index.ts` — exports `startServer`, `startServerOptions`, `createApp`
- `src/cli.ts` — entry: parses args (`--port=0`, `--token=...`, `--repo=...`), calls `startServer`, prints a single line of JSON to stdout (`{"port":<n>,"token":"<...>","pid":<pid>}`) so the Electron supervisor can read it. Handles `SIGTERM`/`SIGINT` clean shutdown.
- `src/server.ts` — boots an HTTP server (Node `http` is fine; no Express/Fastify in v0). Routes per `packages/protocol/src/api.ts`. Uses ephemeral token from env `SANDCASTLE_CONTROL_TOKEN` — every request must include `Authorization: Bearer <token>` or be rejected with 401. Same token guards the WS handshake (`?token=<...>` query param).
- `src/auth/token.ts` — generates a 32-byte URL-safe token if not provided.
- `src/runs/RunSupervisor.ts` — owns lifecycle of every active run. Wraps the `@ai-hero/sandcastle` `run()` call. Subscribes to its `AgentStreamEvent` stream via `callbackAgentStreamEmitterLayer`. Translates events into `RunEvent`s (1:1 mapping where possible) and forwards them to subscribers. Owns `AbortController` per run for cancellation.
- `src/runs/RunIdAllocator.ts` — generates `runId` via nanoid (12 char alphanum). Phase 0 doesn't yet integrate with `WorktreeManager.generateTempBranchName` (Phase 2 work). For now, the runId is internal-only; the engine's existing branch naming continues unchanged. Document this with a TODO referencing Phase 2.
- `src/runs/RunEventProjector.ts` — maintains `Run` snapshots from streaming events. `Run.status` transitions: `queued` → `starting` (on run.started) → `casting` (first text/tool) → `striking` (during edits) → `verifying` (verification.started) → `win-pending` | `fail-pending` (verification.finished) → `victory` | `defeat` | `aborted` (run.resolved). For Phase 0, the simplified state machine is fine; later phases refine.
- `src/repos/RepoRegistry.ts` — Phase 0 single-repo path. Reads `--repo=<path>` from CLI args; verifies it has `.sandcastle/`. Returns `{ root, branch }` from current git state.
- `src/telemetry/SqliteStore.ts` — opens `<repo>/.sandcastle/state/sandcastle.sqlite` via `better-sqlite3`. Creates schema on first boot:
  ```sql
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    directive TEXT NOT NULL,
    branch TEXT,
    worktree_path TEXT,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    result TEXT,
    raw_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS run_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );
  CREATE INDEX IF NOT EXISTS idx_run_events_run_id_seq ON run_events(run_id, seq);
  ```
  Persists every `RunEvent` synchronously. Reads use prepared statements.
- `src/ws/WsHub.ts` — manages WebSocket clients. On connect, sends `hello` and the current `fleet.snapshot`. Forwards `run.event` messages to all subscribers. Per-run text-delta batching at ~30Hz via a coalescing queue (collect `text` deltas in a 33ms window, emit a single concatenated `text.delta` message). Critical state events (`run.statusChanged`, `verification.finished`, `run.resolved`) flush immediately, bypassing the queue.
- `src/projector/SnapshotProjector.ts` — projects `FleetState` from `RunSupervisor` + `RepoRegistry`. Phase 0: one planet (the registered repo), one operative (a synthetic `pi-default` until the operative system lands in Phase 1), runs from supervisor.

**Tests** (vitest, in `test/`):

- `RunSupervisor.test.ts` — uses the existing `no-sandbox` provider to start a real (but trivial) run; verifies events flow to subscribers; cancellation stops the run.
- `SqliteStore.test.ts` — schema creation, run insert/update, event append, replay-on-load.
- `WsHub.test.ts` — connect, subscribe, receive events; verify text-delta batching coalesces; verify critical events flush immediately.
- `server.test.ts` — boots the server, hits `/runs`, hits `/fleet`, opens a WS, asserts protocol shape.
- `auth/token.test.ts` — token generation + request rejection.

**File layout:**

```
packages/control-core/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── server.ts
│   ├── auth/token.ts
│   ├── runs/{RunSupervisor,RunEventProjector,RunIdAllocator}.ts
│   ├── repos/RepoRegistry.ts
│   ├── telemetry/SqliteStore.ts
│   ├── ws/WsHub.ts
│   └── projector/SnapshotProjector.ts
└── test/
    ├── RunSupervisor.test.ts
    ├── SqliteStore.test.ts
    ├── WsHub.test.ts
    ├── server.test.ts
    └── auth/token.test.ts
```

## Repo-wide changes you'll need to make

- Update root `package.json` to add workspaces (`packages/*`) and dev scripts:
  - `"control-core:dev"`: `npm run dev -w @sandcastle/control-core`
  - `"control-core:test"`: `npm run test -w @sandcastle/control-core`
  - `"protocol:test"`: `npm run test -w @sandcastle/protocol`
  - `"typecheck"` should already work; ensure it covers the new packages
  - `"test"` should already work; ensure it includes the new packages
- The root `package.json` `files` array stays `["dist"]`. The new internal packages must NOT be published as part of `@ai-hero/sandcastle`. Verify by running `npm pack --dry-run` and confirming the pack contents are unchanged from before.
- Add a `.changeset/<slug>.md` patch entry: `"@ai-hero/sandcastle: patch — internal: widen AgentStreamEvent (additive); add internal control-core + protocol packages."`
- Do NOT touch `docs/`, `docs/mockups/`, or `docs/IMPLEMENTATION_PLAN.md`.

## Constraints — hard

- **Public API of `@ai-hero/sandcastle` does not change.** `npm pack --dry-run` must show identical pack contents (modulo version bump) before and after your changes. If any test in the existing `src/` suite breaks, fix it back to passing without changing the public surface.
- **No commits.** Do all work uncommitted; the operator will review and commit.
- **Do not run `git push`, `git tag`, `npm publish`, or any command that mutates remote state.**
- **Do not touch `docs/IMPLEMENTATION_PLAN.md`.** That document is the contract you're building to.
- **No new top-level dependencies on `@ai-hero/sandcastle`'s `package.json`.** The new packages own their own deps; the root package gains `private: false` is unchanged. Keep the workspace addition strictly additive at the workspace level.
- **Effect-TS does not leak into the protocol package.** `packages/protocol` must have zero Effect imports. `packages/control-core` may use Effect internally (it imports the engine), but the WS/HTTP boundary speaks plain TypeScript types + zod.
- **All new code must typecheck and test green** at end of dispatch. Run `npm run typecheck` and `npm run test` from the repo root and report the output.

## Output contract

Return a structured report at the end of your work:

```
## Files created
- <path>: <one-line description>

## Files modified (existing)
- <path>: <one-line description of change>

## Tests added
- <path>: <count> tests, all green

## Verification commands run
- `npm run typecheck` → <result>
- `npm run test` → <result>
- `npm pack --dry-run` from the root → <list of files in tarball, must match baseline>
- `cd packages/control-core && npm run dev` (run for ~3s, kill) → confirms boots and prints `{"port":...,"token":...,"pid":...}` JSON line

## Public API check
- `src/index.ts` exports unchanged: <yes/no, with diff if any>
- `AgentStreamEvent` old variants unchanged: <yes/no>
- `RunStatus` exported from `AgentStreamEmitter.ts`: <yes/no>

## Self-review notes
- Anything you guessed about
- Anything you'd want clarified before Phase 1
- Risks for Phase 1 work landing on top of this
```

## Completeness checklist

Before declaring done, every item must be DONE:

- [ ] `AgentStreamEmitter.ts` widened with all 9 new variants; existing `text` and `toolCall` variants byte-identical
- [ ] `RunStatus` exported from `AgentStreamEmitter.ts` and re-exported from `src/index.ts`
- [ ] `run.ts` emits at minimum `run.started`, `run.statusChanged`, `tool.started`, `tool.finished`, `run.resolved` for Phase 0
- [ ] `packages/protocol` package created with all listed files, all tests green
- [ ] `packages/control-core` package created with all listed files, all tests green
- [ ] HTTP server enforces bearer-token auth on every route
- [ ] WS handshake rejects connections without valid token
- [ ] WS forwards real `RunEvent`s from a real `run()` call to subscribers
- [ ] WS text-delta coalescing works at ~30Hz; critical events flush immediately
- [ ] SQLite schema created on first boot; runs and events persist
- [ ] `sandcastle-control` CLI prints `{"port":...,"token":...,"pid":...}` JSON line on startup
- [ ] Cancel endpoint actually aborts an in-flight `run()`
- [ ] `npm run typecheck` from root passes
- [ ] `npm run test` from root passes
- [ ] `npm pack --dry-run` from root produces a tarball with identical contents to baseline (no new files leaked into the published package)
- [ ] Changeset entry added
- [ ] No commits made; working tree shows uncommitted changes only

## Failure handling

If you discover an architectural problem in the plan that blocks completion:

1. STOP and document it in the self-review notes
2. Do NOT silently work around it
3. Propose the smallest amendment to `docs/IMPLEMENTATION_PLAN.md` and stop, awaiting operator decision

If the existing engine source has a bug you need to fix to ship Phase 0 (e.g. `WorktreeManager` collision):

1. Document the bug
2. Apply the smallest possible fix
3. Note it in the self-review for operator review

Begin by reading the listed documents and engine files. Then proceed.
