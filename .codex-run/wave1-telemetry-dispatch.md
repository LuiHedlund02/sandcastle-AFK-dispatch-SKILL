# Wave 1 / Move #3 — Wire real telemetry into planet vitals

## Goal

Make planets "honest" — replace any hardcoded or placeholder telemetry values with real data sourced from the telemetry subsystem. Specifically: `coveragePct`, `ciGreenRate30d`, `openIssues`, `churnScore`, `ageDays`, `testCount`, `branch`, `lastCommitAt`, `lastIndexedAt` on each Planet that ships through `/fleet`.

The infrastructure already exists. This task is **integration + audit**, not greenfield construction.

## Repo orientation

- `packages/control-core/src/telemetry/TelemetryIndexer.ts` — main entry; queries the per-domain readers below and caches results.
- `packages/control-core/src/telemetry/{coverage,ci,issues,churn}/` — per-domain readers.
- `packages/control-core/src/telemetry/SqliteStore.ts` — persisted cache.
- `packages/control-core/src/telemetry/cache.ts` — in-memory cache wrapper.
- `packages/control-core/src/projector/SnapshotProjector.ts` — projects internal state into the `Fleet`/`Planet` shapes the API serves.
- `packages/control-core/src/server.ts` — defines `GET /fleet` and `GET /repos/:id/telemetry` (search for `repoTelemetryMatch`).
- `packages/protocol/src/state.ts` (or similar) — zod schemas for `Planet.telemetry`. Do NOT change the schema; `null` is already valid for missing fields.

## What to do

1. **Audit:** trace the data flow from `GET /fleet` → `SnapshotProjector` → `TelemetryIndexer` → per-domain readers. Identify any place where:
   - A field is hardcoded (e.g. `ciGreenRate30d: 48` returned without calling the CI reader).
   - A field is set to `null` or `undefined` in projector code instead of letting the indexer's null-or-real value flow through.
   - The indexer is called but its result is shadowed by a default.
2. **Wire:** route the indexer's outputs into the projector's planet record. If the indexer hasn't been called yet for a repo, trigger it (lazy or on-snapshot).
3. **Fallback semantics:** when a reader fails or returns no data (e.g. coverage tool not installed, GitHub token missing), the field stays `null` — do NOT substitute a fake number. Log the reason at debug level.
4. **Caching:** the indexer already has a 60s cache (per the codebase's prior summary). Don't bypass it. If you need a fresh read, expose an explicit refresh path; don't blow the cache for routine `/fleet` calls.
5. **Real data smoke test:** after the change, the live server already running at `localhost:4127` (or one you boot fresh) should return real numbers for the local sandcastle repo (e.g. ageDays should reflect the actual git age, openIssues should reflect a real GitHub query _if_ a token is available, otherwise `null`).
6. **Tests:** update or add tests in `packages/control-core/test/` covering: indexer integration into projector, null-passthrough behavior when readers fail, caching boundary.

## Constraints

- Do NOT change the protocol schema in `packages/protocol/`.
- Do NOT modify any UI or screens code — this dispatch is backend-only.
- Do NOT change `src/` (the published engine).
- Stay on `main`. Leave the working tree dirty for human review; do not commit.
- `npm run typecheck` must remain clean across all workspaces.
- `npm test -w @sandcastle/control-core` must pass (135 tests baseline).

## How to verify

```
npm test -w @sandcastle/control-core
npm run typecheck
# manual smoke (skip if --token=smoke-test isn't running):
# curl -sH "Authorization: Bearer smoke-test" http://localhost:4127/fleet | jq '.planetsById | to_entries[] | {repo: .value.repoName, t: .value.telemetry}'
```

## When done

Report:

- Concrete root cause(s): which fields were hardcoded, which were null'd out, which were never wired.
- Files modified with one-line rationale per file.
- Test counts before/after.
- Any new sources you wired (e.g. did you have to call out to `gh` for issues? if so, document the auth path).
- Any field you left as `null` and why (e.g. "coveragePct stays null because no coverage reader is implemented for repos without a `coverage/` dir — that's a separate move").
