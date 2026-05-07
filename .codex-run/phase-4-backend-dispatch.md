# Phase 4 — Backend Slice Dispatch

You are gpt-5.5 (Codex), dispatched by Claude (Opus 4.7) to build the backend half of Phase 4 of Sandcastle. Phase 0–3 are committed. Your scope: **real telemetry sources** (coverage / CI green-rate / open issues / churn), the **GitHub adapter** that supports them, and the **XP ledger** that records merge-driven XP with patch-identity tracking and revert detection. Frontend (Victory/Defeat ceremonies + planet/map data binding) is a separate Opus subagent dispatch.

Read these first (do not skip):

1. `docs/IMPLEMENTATION_PLAN.md` §7 Phase 4 and §4 (XP rule v1).
2. `packages/control-core/src/telemetry/TelemetryIndexer.ts` — the existing skeleton; you're filling in the four `null` fields.
3. `packages/control-core/src/decisions/DecisionActions.ts` — where you'll wire the XP ledger.
4. `packages/protocol/src/{state,events}.ts` — `ActivityEvent` already declared in IMPLEMENTATION_PLAN §3 but probably not in the file yet — you'll add it.
5. `git log --oneline -10` — commit message style.

## What "done" means for Phase 4 backend

1. **Real telemetry indexers**, each in its own module under `packages/control-core/src/telemetry/<domain>/`:
   - **`coverage/`** — reads `coverage/coverage-summary.json` (vitest's default) or `coverage/lcov.info` if present. Returns `coveragePct: number | null` (lines pct). Returns `null` when no coverage report exists. Cache 60s in SQLite.
   - **`ci/`** — green-rate over the last 30 days. Two backends:
     - **GitHub Actions adapter** (preferred when configured): `GET /repos/:owner/:repo/actions/runs?status=completed&created=>=<30d-ago>`, count `conclusion === "success"` over total. Uses `github` adapter from §2.
     - **Local-git fallback**: count commits with `[ci]` / `chore(ci)` style prefixes vs reverts of those — best-effort. Returns `null` if no signal.
   - **`issues/`** — open-issue count. Two backends:
     - **GitHub Issues adapter** (when `gh` auth or `GITHUB_TOKEN` is available): `GET /repos/:owner/:repo/issues?state=open&per_page=1` and read pagination metadata for the count, NOT fetch all issues.
     - **Local fallback**: count `TODO:` / `FIXME:` strings in source files (excluding `node_modules` / `dist` / `.git`). Returns `null` if no signal.
   - **`churn/`** — last 30 days, files-changed-per-commit median × commits-touching-the-most-changed-file. The math doesn't matter for v1 — the key is "produces a comparable score" not "is statistically defensible." Use git log + a small in-memory aggregation. Cap at 1000.
2. **GitHub adapter** at `packages/control-core/src/github/`:
   - `GitHubClient.ts` — minimal REST client. Uses `GITHUB_TOKEN` env or `gh auth token` shell-out. Honors rate limit (returns last-known cached value if rate limited). Resolves `<owner>/<repo>` from the repo's git remote (`git remote get-url origin`). Returns `null` (not throws) when the repo has no GitHub remote — telemetry then falls back to local heuristics.
   - `parseGitRemote.ts` — pulls `<owner>/<repo>` out of `git@github.com:owner/repo.git` and `https://github.com/owner/repo[.git]`.
3. **TelemetryIndexer** updated to populate the four previously-null fields, calling the new domain modules in parallel via `Promise.all`. Each domain logs warnings to stderr on failure but never throws — telemetry is best-effort.
4. **XP ledger** at `packages/control-core/src/xp/XpLedger.ts`:
   - `recordMerge({ runId, repoRoot, beforeCommit, afterCommit, mergedIntoBranch, linkedIssueNumber? })` → walks commits in `beforeCommit..afterCommit` (or the diff if it's a squash merge), computes a **patch identity hash** = sha256 of the canonical diff (no whitespace-only changes, no merge commit metadata). Records the run in SQLite `xp_ledger` table with: runId, repoRoot, patchHash, baseXp (500), bonus (linked-issue 250 if `linkedIssueNumber` is provided), penalty (0), netXp (capped at 2500), recordedAt.
   - `detectReverts(repoRoot)` — scans the last 14 days of commits for revert messages or for patch hashes in the ledger that no longer appear in `git log` (rebased-out). Marks affected ledger entries with `revertedAt` and zeros their netXp.
   - `getOperativeXp(operativeId)` and `getRunXp(runId)` query helpers.
   - The XP rule from §4: no XP for merge-only commits (`git log --first-parent`-only), empty diffs, or pure rebases.
5. **Activity feed** at `packages/control-core/src/activity/ActivityFeed.ts`:
   - `ActivityEvent` (typed per IMPLEMENTATION_PLAN §3) persisted to a new `activity_events` SQLite table.
   - `RunSupervisor` writes activity events on `run.started`, `run.statusChanged`, `tool.called`, `intervention.used`, `run.resolved`.
   - `getRecent(repoRoot, limit=50)` query helper.
6. **`DecisionActions.merge`** wires through `XpLedger.recordMerge` after a successful merge. The result includes `xpDelta` so the UI can show "+500 XP" in the merge confirmation.
7. **Protocol additions** (additive only):
   - `zActivityEvent` discriminated union in `events.ts`.
   - `RepoTelemetry.coveragePct` etc. stay typed as `number | null`; just no longer always null.
   - `PostRunDecisionResponse` extended with optional `xpDelta?: number`.
   - HTTP: `GET /repos/:id/activity?limit=50` → `{ events: ActivityEvent[] }`. `GET /operatives/:id/xp` → `{ totalXp, recentRuns: { runId, netXp, recordedAt }[] }`.

## Hard rules

- **Public API of `@ai-hero/sandcastle` stays additive.** `npm pack --dry-run` from repo root still 222 files.
- **No engine `src/` changes.** Phase 4 lives entirely in control-core + protocol.
- **Effect-TS stays inside the engine.** Control-core stays plain TS.
- **GitHub adapter is best-effort.** Network failure = `null` returned. Never throws.
- **All shell-outs use `execFile` not `exec`.** No shell injection.
- **Telemetry indexers never write to user state files.** Only the SQLite cache.
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Tests must run.** Each domain indexer has a fixture-repo unit test. XpLedger has patch-id + revert-detection tests. ActivityFeed has projection tests.
- **Workspace deps:** `"*"`, never `workspace:*`.
- **Don't commit.** Leave the working tree dirty.
- **Don't add `gray-matter` or other heavyweight deps**; use stdlib + the existing `better-sqlite3` + zod.

## Layout to add / modify

```
packages/protocol/src/
  events.ts                              # ADD: zActivityEvent discriminated union
  state.ts                               # ADD: zXpLedgerEntry, zOperativeXpSummary
  api.ts                                 # ADD: zGetActivityResponse, zGetOperativeXpResponse; PostRunDecisionResponse extended

packages/control-core/src/
  github/
    GitHubClient.ts                      # NEW: REST client, token resolution, rate-limit aware
    parseGitRemote.ts                    # NEW: <owner>/<repo> extraction
  telemetry/
    coverage/CoverageReader.ts           # NEW
    ci/CiRateReader.ts                   # NEW
    issues/IssueCountReader.ts           # NEW
    churn/ChurnReader.ts                 # NEW
    TelemetryIndexer.ts                  # MODIFY: parallel-fetch the four domains
    SqliteStore.ts                       # ADD: xp_ledger + activity_events tables
  xp/
    XpLedger.ts                          # NEW
    patchIdentity.ts                     # NEW: canonical-diff sha256 helper
  activity/
    ActivityFeed.ts                      # NEW
  decisions/
    DecisionActions.ts                   # MODIFY: wire XpLedger.recordMerge
  runs/
    RunSupervisor.ts                     # MODIFY: emit ActivityEvents on subscribe path
  server.ts                              # ADD: GET /repos/:id/activity, GET /operatives/:id/xp
```

## Tests to write (must all pass)

```
packages/control-core/test/
  github/parseGitRemote.test.ts          # 6 fixtures: ssh, https, .git suffix, GH Enterprise, malformed
  github/GitHubClient.test.ts            # mocked fetch; rate-limit cached fallback path
  telemetry/coverage/CoverageReader.test.ts
    - reads vitest coverage-summary.json
    - falls back to lcov.info
    - returns null when no report
  telemetry/ci/CiRateReader.test.ts
    - mocked GitHub adapter: 30 runs, 24 success → 80%
    - no remote: returns null (local-fallback heuristic noise is fine)
  telemetry/issues/IssueCountReader.test.ts
    - mocked GitHub adapter: pagination header → 47 open
    - local fallback: counts TODO/FIXME in fixture src tree
  telemetry/churn/ChurnReader.test.ts
    - against fixture git repo (5 commits, edits to file A and B): produces a deterministic numeric score
  xp/XpLedger.test.ts
    - recordMerge stores patch hash + base XP
    - same patch hash from a second run is rejected (no double credit)
    - detectReverts: a revert commit zeroes the entry's netXp
    - rebased-out patch hash also zeros (patch no longer in git log)
    - cap enforced at 2500
    - linked-issue bonus +250
  xp/patchIdentity.test.ts
    - whitespace-only changes hash to the same identity as no-change diff (i.e. excluded)
    - identical content edits hash identically across two repos
  activity/ActivityFeed.test.ts
    - run.started → run.resolved produces the expected events in order
    - getRecent honors limit + repoRoot filter
  decisions/DecisionActions.merge.test.ts
    - on successful merge: PostRunDecisionResponse carries xpDelta
    - revert path: subsequent recordMerge of the reverted patch is rejected
  server.activity.test.ts
    - GET /repos/:id/activity?limit=10 with auth
  server.operative-xp.test.ts
    - GET /operatives/:id/xp returns totalXp + recentRuns
```

## Verification you must run

- [ ] `npm run typecheck` from repo root: green
- [ ] `npm test -w @sandcastle/protocol`: still all green
- [ ] `npm test -w @sandcastle/control-core`: all green (existing 86 + your new ones)
- [ ] `npm pack --dry-run` from repo root: 222 files
- [ ] If your env can run a real git fixture for ChurnReader / XpLedger, run those. If sandbox blocks spawn/git, say so explicitly — do not skip silently.

## Open decisions you may resolve

1. **Coverage parser**: vitest writes `coverage/coverage-summary.json` by default. Read that first; fall back to `lcov.info` parser only if summary missing. Don't try to parse multiple formats simultaneously.
2. **Issues fallback heuristic accuracy**: counting `TODO:`/`FIXME:` is honest but obviously low-signal. Document in jsdoc that this is a placeholder until GitHub auth is configured.
3. **Patch identity normalization**: strip leading/trailing whitespace per line, collapse trailing-newline differences, exclude file-mode-only changes. Don't try to be clever with semantic diffs.
4. **XpLedger storage**: a single row per merge in SQLite; revert detection writes `revertedAt` + zeroes a `netXp` column. Keep the full original record for audit.
5. **Activity-feed cap**: store unbounded for now (Phase 4 doesn't include log rotation); a cron-like cleanup is Phase 6+.

## What is OUT of scope

- Frontend (separate Opus subagent): Victory / Defeat / planet biomes / map monsters
- Hosted-web v2 transport extraction (Phase 6)
- Provider adapter materialization (Phase 5)
- Plugin SDK (out of v1 entirely)

## Deliverable

Working tree dirty:

- `packages/control-core/src/{github,telemetry,xp,activity}/` populated
- `packages/control-core/src/{decisions,runs,server,telemetry/SqliteStore}.ts` integrations
- `packages/protocol/src/{events,state,api}.ts` extensions
- All tests
- `.changeset/phase-4-telemetry-xp.md` patch entry

Report:

1. File tree of additions / modifications
2. Verification results (typecheck, each test suite pass count, npm pack count, blocked-by-env steps if any)
3. Any open items, deviations, or engine bugs you spotted but didn't touch
