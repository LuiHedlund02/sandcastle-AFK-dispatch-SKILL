# Sandcastle UX Expansion — Implementation Plan

> **Status:** v0.1 — locked architecture, phased build.
> **Sources:** Three independent AI engineering reviews (gpt-5.4 / gpt-5.2 / gpt-5.5) plus the locked product model from the design conversation.
> **Reviews preserved at:** `.codex-run/dispatch-prompt.md`, `.codex-run/codex-plan-final.md`.
> **Mockups preserved at:** `docs/mockups/` (12 HTML files + index).

---

## 1. The eight locked calls

Every phase below is downstream of these decisions. Do not relitigate without good cause.

| #   | Decision                       | Locked answer                                                                                                                                                                                                                                                               |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Process/transport boundary** | Separate Node control process. HTTP/WebSocket from day 1. Electron is a thin supervisor that launches the control server on `127.0.0.1` with an ephemeral token and loads the Vite UI. No daemon installer, no auth, no port discovery in v1.                               |
| 2   | **Operative state location**   | Split-state hybrid. **Identity** at `~/.sandcastle/operatives/<id>.json` (codename, class, level, bond, global XP, sleeve). **Per-project record** at `<repo>/.sandcastle/state/` (deployment history, runs done here, planet-specific bond, scars). They merge at runtime. |
| 3   | **Telemetry storage**          | SQLite from day 1 at `<repo>/.sandcastle/state/sandcastle.sqlite`. Markdown stays canonical for `agents.md` / `skills/*.md` / `commands/*.md`. Raw provider logs at `<repo>/.sandcastle/logs/*.jsonl`.                                                                      |
| 4   | **IPC cadence**                | Semantic events over WebSocket. RAF coalescing in renderer. Text deltas batched per-run at ~30Hz. Critical state transitions flush immediately. Fleet/dock aggregate snapshots every 250ms or on change.                                                                    |
| 5   | **Stack**                      | TypeScript + Effect (engine, unchanged) → control-core (new, Effect) → HTTP/WS protocol → Vite + React 19 + Zustand + TanStack Query (UI). Tailwind v4 + CSS Modules + Framer Motion. Electron supervisor only.                                                             |
| 6   | **Phase 0 deliverable**        | Cockpit MVP. One real run, end-to-end, with cancellation. Galaxy / Planet / Roster / Operative all defer to Phase 1+.                                                                                                                                                       |
| 7   | **Engine work prerequisite**   | Widen `AgentStreamEmitter` to emit lifecycle/verification/decision events. Build `RepoRunCoordinator` for worktree concurrency safety. Without these, the parallel-run promise is hollow.                                                                                   |
| 8   | **Accessibility from day 1**   | Reduced-motion mode, high-contrast mode, font scaling, no critical info conveyed by color alone. Shipped in the visual primitives, not patched in later.                                                                                                                    |

---

## 2. Architecture

### 2.1 Process model

```
┌─────────────────────────────────────────────────────────────────────┐
│ Desktop App (Electron supervisor)                                   │
│  · launches control process on 127.0.0.1:<random-port>              │
│  · passes ephemeral token via env                                    │
│  · loads Vite UI at http://127.0.0.1:<port>?token=<...>             │
│  · supervises (auto-restart on crash, kill on exit)                 │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ spawns
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Control Process (Node + Effect)                                     │
│  · @sandcastle/control-core  (new package)                          │
│  · serves Vite UI bundle as static assets                           │
│  · HTTP routes for queries/commands                                 │
│  · WebSocket for run streams + fleet state                          │
│  · imports @ai-hero/sandcastle engine directly                      │
│  ┌─────────────────────────────────────┐                            │
│  │ RunSupervisor                       │                            │
│  │ RepoRunCoordinator (NEW)            │                            │
│  │ FleetBudgetService                  │                            │
│  │ DeckLoader                          │                            │
│  │ ProviderAdapterRegistry             │                            │
│  │ TelemetryIndexer (SQLite)           │                            │
│  │ SnapshotProjector                   │                            │
│  └──────────────┬──────────────────────┘                            │
│                 │ imports                                           │
│                 ▼                                                   │
│  @ai-hero/sandcastle engine (unchanged public API)                  │
│  · run() / interactive() / wt.run()                                 │
│  · Orchestrator / SandboxFactory / SandboxLifecycle                 │
│  · WorktreeManager / AgentStreamEmitter (WIDENED)                   │
│  · sandbox providers: docker | podman | vercel | daytona            │
└─────────────────────────────────────────────────────────────────────┘
                  ▲
                  │ HTTP + WebSocket (same protocol works for hosted v2)
                  │
┌─────────────────┴───────────────────────────────────────────────────┐
│ Renderer (Vite + React 19) — running in Electron BrowserWindow      │
│  · Zustand fleet store (projection from server snapshots)           │
│  · TanStack Query for request/cache state                           │
│  · React Router 7 for routes                                        │
│  · Framer Motion + Tailwind + CSS Modules                           │
│  · Apply WS events at requestAnimationFrame cadence                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why this shape

- **Engine in a separate process** so Docker/Vercel/git operations don't block the UI thread, and so the same protocol later powers a hosted v2 with no rewrite
- **Electron is a supervisor**, not a host — its only job is launching the control process and rendering the UI bundle
- **Renderer never imports the engine** — typed protocol is the only contract
- **Same wire format for desktop v1 and hosted v2**. v2 = remote API gateway swap.

### 2.3 Worktree concurrency (NEW — gpt-5.5 finding)

`WorktreeManager.ts` has concrete bugs that block the "5 parallel runs" promise:

- Temp branch names timestamped only to the second → collision when two runs launch in the same second
- Named runs collide too (`sandcastle/<name>/<timestamp>`)
- Explicit branch mode reuses dirty worktrees → dangerous for concurrent UI runs
- Auto-merge on completion isn't serialized → race when multiple runs land on the same default branch

**Fix in Phase 0/1:** introduce `RepoRunCoordinator`:

- Every UI run gets a unique `runId` (nanoid)
- Temp branch names include `runId`, not just timestamp: `sandcastle/<runId>` or `sandcastle/<name>/<runId>`
- Parallel runs to same repo/default branch: only allowed in temp-branch mode
- Merges into target branch: serialized per repo/target branch (mutex)
- Explicit branch runs: require a per-branch lock, one active run per branch
- `head` strategy: disallowed for parallel UI runs (we'll surface a clear error)

### 2.4 Streaming surface (NEW — gpt-5.5 finding)

Current `AgentStreamEmitter` only emits `text` and `toolCall` and ties to file logging. The cockpit needs:

```ts
type RunEvent =
  | { type: "run.started"; runId; payload: { directive; branch; worktree } }
  | {
      type: "run.statusChanged";
      runId;
      payload: { from: RunStatus; to: RunStatus };
    }
  | { type: "tool.started"; runId; payload: { name; formattedArgs } }
  | { type: "tool.finished"; runId; payload: { name; durationMs; ok; output? } }
  | { type: "text.delta"; runId; payload: { text } } // 30Hz batch per run
  | { type: "verification.started"; runId; payload: { checks: string[] } }
  | {
      type: "verification.finished";
      runId;
      payload: { allGreen; failedChecks: string[] };
    }
  | {
      type: "decision.required";
      runId;
      payload: { kind: "merge" | "revise" | "discard" };
    }
  | {
      type: "run.resolved";
      runId;
      payload: { result: "victory" | "defeat" | "aborted"; xpDelta };
    }
  | { type: "intervention.used"; runId; payload: { action } };
```

Engine emits these as Effect streams; control-core projects them into `FleetState` snapshots.

---

## 3. Data model (locked)

```ts
// providers
type ProviderId = "claude-code" | "codex" | "pi" | "opencode";
type CardType = "mode" | "skill" | "command";

// run lifecycle
type RunStatus =
  | "queued"
  | "starting"
  | "casting"
  | "striking"
  | "verifying"
  | "win-pending"
  | "fail-pending"
  | "victory"
  | "defeat"
  | "aborted";

type OperativeMicroState = "idle" | "casting" | "striking" | "crit" | "hit";

// cards (provider-neutral; Markdown is canonical)
interface CardBase {
  id: string;
  type: CardType;
  slug: string;
  title: string;
  summary: string;
  sourcePath: string; // repo-relative .sandcastle path
  enabled: boolean;
  tags: string[];
  body: string; // markdown body sans frontmatter
  updatedAt: string; // ISO
}
interface ModeCard extends CardBase {
  type: "mode";
  constraints: string[];
}
interface SkillCard extends CardBase {
  type: "skill";
  passive: true;
  triggerHints: string[];
}
interface CommandCard extends CardBase {
  type: "command";
  slashCommand: `/${string}`;
  argsSchema?: Record<string, string>;
  verifyHints: string[];
}
type Card = ModeCard | SkillCard | CommandCard;

interface Deck {
  version: 1;
  mode: ModeCard;
  skills: SkillCard[];
  commands: CommandCard[];
  order: string[]; // stable UI ordering across all cards
}

// operative — split state
interface OperativeIdentity {
  // ~/.sandcastle/operatives/<id>.json
  id: string;
  codename: string;
  provider: ProviderId;
  model: string; // chassis
  species: string;
  className: string;
  level: number; // global, across all planets
  globalXp: number;
  bond: number;
  streak: number;
  concurrencyCap: number;
  sleeveCardIds: string[]; // IDs of personal-sleeve cards
  unlockedTraits: string[];
}
interface OperativeRepoRecord {
  // <repo>/.sandcastle/state/operatives.<id>.json
  operativeId: string;
  planetId: string;
  firstLandedAt: string;
  lastLandedAt: string;
  runIds: string[];
  victoriesCount: number;
  defeatsCount: number;
  planetSpecificBond: number;
  scarsEarnedHere: string[];
}

// planet
interface Planet {
  // <repo>/.sandcastle/planet.json
  id: string;
  repoName: string;
  repoRoot: string;
  defaultBranch: string;
  terraformStage: number; // 0..5
  scars: string[];
  wards: string[]; // usually test-file-backed
  deck: Deck; // loaded from agents.md + skills/ + commands/
  telemetry: {
    coveragePct: number | null;
    ciGreenRate30d: number | null;
    openIssues: number | null;
    churnScore: number | null;
    ageDays: number | null;
    testCount: number | null;
    lastIndexedAt: string | null;
  };
  activeRunIds: string[];
  lastRunAt: string | null;
}

// run
interface Phase {
  id: string;
  runId: string;
  ordinal: number;
  title: string;
  directiveSlice: string;
  objective: string;
  xpEstimate: number;
  verifyRules: string[];
  status: "pending" | "active" | "verified" | "failed" | "skipped";
  startedAt: string | null;
  endedAt: string | null;
}

interface Run {
  id: string; // nanoid; used in branch names
  planetId: string;
  operativeId: string;
  provider: ProviderId;
  sandboxProvider: string;
  status: RunStatus;
  directive: string;
  branch: string; // includes runId
  worktreePath?: string;
  startedAt: string;
  endedAt: string | null;
  phaseIds: string[];
  currentPhaseId: string | null;
  verification: { allGreen: boolean; failedChecks: string[] };
  totals: {
    toolCalls: number;
    filesEdited: number;
    commandsRun: number;
    tokensIn?: number;
    tokensOut?: number;
  };
}

// activity feed event
type ActivityEvent =
  | {
      id;
      at;
      type: "run.started";
      runId;
      planetId;
      operativeId;
      payload: { directive };
    }
  | {
      id;
      at;
      type: "run.status-changed";
      runId;
      planetId;
      operativeId;
      payload: { from: RunStatus; to: RunStatus };
    }
  | {
      id;
      at;
      type: "phase.updated";
      runId;
      planetId;
      operativeId;
      payload: { phaseId; status: Phase["status"] };
    }
  | {
      id;
      at;
      type: "tool.called";
      runId;
      planetId;
      operativeId;
      payload: { name; formattedArgs };
    }
  | {
      id;
      at;
      type: "intervention.used";
      runId;
      planetId;
      operativeId;
      payload: { action };
    }
  | {
      id;
      at;
      type: "run.resolved";
      runId;
      planetId;
      operativeId;
      payload: { result: "victory" | "defeat" | "aborted"; xpDelta };
    };

// projected renderer state
interface FleetState {
  planetsById: Record<string, Planet>;
  operativesById: Record<
    string,
    OperativeIdentity & { repoRecord?: OperativeRepoRecord }
  >;
  runsById: Record<string, Run>;
  phasesById: Record<string, Phase>;
  dockOrder: string[]; // runIds, current order for FleetDock
  pendingDecisions: Array<{
    runId: string;
    kind: "merge" | "revise" | "replay" | "discard" | "recover";
  }>;
  capacity: { used: number; max: number }; // operative budget
  updatedAt: string;
}
```

---

## 4. XP rule (v1) — fair enough to ship

> XP accrues only when a Sandcastle-managed run produces non-empty code changes that are merged through Sandcastle into the target branch after configured verification passes.

Rules:

- No XP for merge-only commits
- No XP for empty diffs
- No XP for rebasing existing user commits
- XP keyed by **patch identity** (resulting diff content hash), not commit count
- Hard cap per run (e.g. 500 XP base, multipliers cap total at 2,500 XP)
- Bonus only if a linked issue is closed by the same merge
- Penalty if a revert commit appears for that patch within 7 days, or the patch-id disappears from history (rebase-out detection)

Not cheat-proof. v1 is single-player. Goal is "not trivially stupid."

---

## 5. Repository structure (target layout)

```
sandcastle/                              # existing repo
├── package.json                         # workspaces: . + apps/* + packages/*
├── src/                                 # existing engine — NO PUBLIC API CHANGE
│   ├── main.ts
│   ├── run.ts
│   ├── Orchestrator.ts
│   ├── WorktreeManager.ts               # widened with RepoRunCoordinator integration
│   ├── AgentStreamEmitter.ts            # widened (lifecycle/verification/decision events)
│   └── ...
├── packages/
│   ├── protocol/                        # NEW — shared types + zod schemas
│   │   └── src/
│   │       ├── events.ts                # RunEvent, ActivityEvent
│   │       ├── state.ts                 # Planet, Operative, Run, Phase, FleetState
│   │       ├── api.ts                   # HTTP route shapes
│   │       └── ws.ts                    # WS message envelope + types
│   ├── control-core/                    # NEW — Node + Effect server
│   │   └── src/
│   │       ├── server.ts                # HTTP + WS server
│   │       ├── auth/token.ts            # ephemeral local token
│   │       ├── repos/RepoRegistry.ts
│   │       ├── runs/RunSupervisor.ts
│   │       ├── runs/RepoRunCoordinator.ts   # NEW — fixes worktree concurrency
│   │       ├── runs/RunEventProjector.ts
│   │       ├── deck/DeckLoader.ts
│   │       ├── adapters/
│   │       │   ├── AgentProviderAdapter.ts
│   │       │   ├── ClaudeCodeAdapter.ts
│   │       │   ├── CodexAdapter.ts
│   │       │   └── PiAdapter.ts
│   │       ├── telemetry/SqliteStore.ts # better-sqlite3
│   │       ├── telemetry/TelemetryIndexer.ts
│   │       └── projector/SnapshotProjector.ts
│   └── ui/                              # NEW — React component library
│       └── src/
│           ├── tokens/                  # CSS vars: cyan/magenta/etc, motion tokens
│           ├── primitives/
│           │   ├── fleet/{FleetDock,FleetDockCell,MergeAllGreenButton}
│           │   ├── deploy/{DeployChordOverlay,DeployChordParserPreview}
│           │   ├── operative/{ReactiveOperativeTile,OperativePortrait}
│           │   ├── planet/PlanetSvgRenderer
│           │   ├── galaxy/GalaxySvgRenderer
│           │   ├── cards/{CardFrame,ModeCardView,SkillCardView,CommandCardView}
│           │   ├── timeline/ToolTimelineCard
│           │   ├── fx/{CRTRasterOverlay,FilmGrainOverlay,ChromaticHeadline}
│           │   └── layout/{OctaPanel,AppChrome}
│           ├── screens/                 # one folder per mockup
│           ├── hooks/                   # useFleetState, useRunStream, etc.
│           └── a11y/                    # reduced-motion, high-contrast, font-scale
└── apps/
    └── desktop/                         # NEW — Electron supervisor
        ├── electron/
        │   ├── main.ts                  # supervisor: spawn control-core + open window
        │   └── preload.ts               # passes token to renderer
        └── src/renderer/
            ├── main.tsx                 # Vite entry
            └── routes/                  # React Router 7 file-based routes
                ├── __root.tsx           # AppChrome (FleetDock + DeployChordOverlay)
                ├── index.tsx
                ├── fleet.tsx
                ├── planet.$planetId.tsx
                ├── planet.$planetId.map.tsx
                ├── quest-forge.tsx
                ├── runs.$runId.cockpit.tsx
                ├── runs.$runId.combat.tsx
                ├── runs.$runId.victory.tsx
                ├── runs.$runId.defeat.tsx
                ├── roster.tsx
                └── operatives.$operativeId.tsx
```

`<repo>/.sandcastle/` (per-project, generated by `sandcastle init`):

```
.sandcastle/
├── .env
├── main.ts                 # legacy CLI compat
├── prompt.md               # legacy CLI compat
├── planet.json             # canonical planet identity, terraform stage
├── agents.md               # MODE card (markdown; canonical)
├── skills/*.md             # SKILL cards (markdown; canonical)
├── commands/*.md           # SLASH COMMAND cards (markdown; canonical)
├── state/
│   ├── sandcastle.sqlite           # local telemetry, run history, XP ledger (gitignored)
│   └── operatives.<id>.json        # per-project operative records
└── logs/
    └── runs/<runId>/*.jsonl         # raw provider session logs (gitignored)
```

`~/.sandcastle/` (per-user, global):

```
~/.sandcastle/
├── operatives/<id>.json    # operative identity (codename, level, bond, sleeve)
├── settings.json           # UI prefs, theme, accessibility
└── repos.json              # registered repos
```

---

## 6. Provider adapter contract (locked)

```ts
interface ProviderMaterializedFile {
  relativePath: string; // path inside sandbox/worktree
  content: string;
}

interface ProviderAdapterInput {
  repoRoot: string;
  sandcastleDir: string;
  deck: Deck;
  planet: Planet;
  operative: OperativeIdentity;
  run: Run;
  directive: string;
}

interface ProviderAdapterOutput {
  files: ProviderMaterializedFile[]; // emitted into worktree/sandbox staging only
  env?: Record<string, string>;
  promptPrelude?: string;
  cleanupPaths?: string[];
}

interface AgentProviderAdapter {
  id: ProviderId;
  materialize(input: ProviderAdapterInput): Promise<ProviderAdapterOutput>;
}
```

Generated provider files (`.claude/skills/`, `AGENTS.md`, etc.) are **materialized into the sandbox/worktree only**, never committed as canonical state. The deck stays provider-neutral.

---

## 7. Phased build plan

**Total target:** ~14–17 weeks of one engineer to reach Phase 6.

### Phase 0 — Cockpit MVP over one real run (2 weeks)

**Outcome:**

- `sandcastle ui` command launches local control server + opens Electron window
- One repo (the cwd) is auto-opened
- One screen: **Cockpit**
- One persistent dock + deploy stub (visual only — chord overlay opens, can't deploy yet)
- Start one **real** Sandcastle run from the UI using existing provider/sandbox config
- Stream real `text` and `toolCall` events into the timeline (text deltas batched at ~30Hz)
- Show status: starting / running / verifying / complete / failed / cancelled
- Cancel via `AbortController`
- Persist run + events in SQLite at `<repo>/.sandcastle/state/sandcastle.sqlite`
- Show log path, branch, worktree path, commits when run finishes
- Minimal cyberpunk skin: octagonal panel + reactive operative tile + CRT/grain overlays + accessibility modes from day 1
- **NO galaxy, NO planet map, NO roster, NO multi-project, NO 5-parallel, NO XP, NO boss fights, NO Victory/Defeat ceremony**

**File scope:**

- `src/AgentStreamEmitter.ts` — widen to emit lifecycle events (additive, no breaking change)
- `src/cli.ts` — add `sandcastle ui` command
- `packages/protocol/**` — initial event + state schemas
- `packages/control-core/**` — server, RunSupervisor, SqliteStore, RepoRegistry (single-repo path)
- `packages/ui/src/{tokens,primitives/{fleet,deploy,operative,timeline,fx,layout}}/**` — minimum primitives
- `packages/ui/src/screens/cockpit/**`
- `apps/desktop/electron/{main.ts,preload.ts}` — supervisor only
- `apps/desktop/src/renderer/{main.tsx,routes/__root.tsx,routes/runs.$runId.cockpit.tsx}`

**Tests:**

- Protocol schema validation (zod parse round-trip)
- AgentStreamEmitter widened-event emission tests
- Control-core: start-run/cancel-run integration tests against `no-sandbox` provider
- SqliteStore CRUD tests
- Cockpit screen smoke tests (msw-mocked WS)

**User can do:**

- Run `sandcastle ui` in any Sandcastle repo
- Type a directive, hit deploy
- Watch real text/tool-call timeline
- Cancel mid-run
- See commits + branch + worktree path on completion

**User cannot do yet:**

- Multi-project / multi-run
- Use the full deploy chord (multi-target)
- See planets / roster / galaxy
- Earn XP

**Verification commands at end of Phase 0:**

```bash
npm run typecheck
npm run test
npm run desktop:dev          # spawns control-core + Electron
npm run desktop:test
npm run desktop:build        # produces unsigned dev build
```

---

### Phase 1 — Multi-repo registry, full primitives, planet/roster/operative read-only (2 weeks)

**Outcome:**

- Repo registry at `~/.sandcastle/repos.json`; user can add/remove repos
- 5 more screens scaffolded (read-only): Fleet, Planet, Roster, Operative, QuestForge (parser preview only)
- Full visual primitive system: octagonal panels, CRT/grain, chromatic headline, all card frames
- Basic git telemetry: age, branch, last commit, file count
- Deck loading from `.sandcastle/{agents.md, skills/, commands/}` with frontmatter parsing
- Operative identity persists at `~/.sandcastle/operatives/<id>.json`
- Per-repo operative records persist at `<repo>/.sandcastle/state/operatives.<id>.json`

**File scope:**

- `packages/control-core/src/{repos/RepoRegistry,deck/DeckLoader,telemetry/TelemetryIndexer}/**`
- `packages/ui/src/{primitives/{planet,galaxy,cards,layout},screens/{fleet,planet,roster,operative,quest-forge}}/**`
- `apps/desktop/src/renderer/routes/{fleet,planet.$planetId,planet.$planetId.map,quest-forge,roster,operatives.$operativeId}.tsx`

**Tests:**

- DeckLoader fixtures (valid/invalid frontmatter, missing files)
- RepoRegistry CRUD
- TelemetryIndexer derives age/branch correctly
- Screen smoke tests for all 5

**User can do:**

- Add multiple repos to the registry
- Browse Fleet (with stub data for non-current repos), open Planet detail, see deck contents
- Browse Roster, open Operative dossier
- Type into QuestForge and see directive parsed inline (no engagement yet)

---

### Phase 2 — Multi-project parallel runs + RepoRunCoordinator (2 weeks)

**Outcome:**

- `RepoRunCoordinator` lands; worktree concurrency bugs are fixed
- Same operative can run on N planets in parallel (up to focus budget)
- Fleet dock shows N concurrent cells with live state
- Multi-target deploy chord works (`deploy [op] to [planet, planet, planet] :: [directive]`)
- Mini decision cards pop from win-pending / fail-pending dock cells
- `Merge all green ⌘⇧M` works (gated behind all-green verification)

**File scope:**

- `src/WorktreeManager.ts` — runId-based naming
- `packages/control-core/src/runs/RepoRunCoordinator.ts` — new
- `packages/control-core/src/fleet/FleetBudgetService.ts` — concurrency cap enforcement
- `packages/ui/src/primitives/deploy/**` — full chord with parser preview + scope-overlap detection
- `packages/ui/src/primitives/fleet/WinPendingDecisionCard.tsx`

**Tests:**

- Worktree allocator: 100 parallel runs to same repo, no branch collisions
- Merge serialization: 5 runs to same default branch, no race
- FleetBudgetService: cap enforcement
- Deploy chord parser tests
- WS events: 5 concurrent run streams projected correctly

**User can do:**

- Open 3 repos, deploy same operative to all 3 with one directive, watch all 3 in dock simultaneously
- Cancel any one, merge any one, revise any one — without modal interruptions

---

### Phase 3 — QuestForge + phase model + Combat screen (2 weeks)

**Outcome:**

- Directive parser produces explicit phases with verify rules
- QuestForge engage button starts a phased run
- Combat screen re-skins the run timeline as a turn-based fight
- Phase XP and verify rules become real objects, not UI text

**File scope:**

- `packages/control-core/src/quest-forge/{Parser,VerifyRules}/**`
- `packages/protocol/src/phases.ts`
- `packages/ui/src/screens/{quest-forge,combat}/**`

**Tests:**

- Parser: 20 directive fixtures → expected phase decomposition
- Verify-rule schema (zod)
- Combat projection from phase events

**User can do:**

- Draft a directive, see phases extracted, edit phases, engage
- Watch a phased run in Combat view with phase-by-phase progress

---

### Phase 4 — Real telemetry + Victory/Defeat ceremony (2–3 weeks)

**Outcome:**

- Coverage, CI green-rate, open issues, churn, age become real (cached in SQLite, refreshed on demand)
- Planet ortho-map renders biomes from real directory data
- Map screen renders region monsters from real GitHub issues
- Victory and Defeat screens are data-backed and opt-in (only via clicking dock cell)
- XP rule enforced; activity feed populated

**File scope:**

- `packages/control-core/src/telemetry/{coverage,ci,issues,churn}/**`
- `packages/control-core/src/github/**` (issue adapter, optional Beads adapter)
- `packages/control-core/src/xp/XpLedger.ts` — implements the v1 XP rule
- `packages/ui/src/screens/{victory,defeat}/**`
- `packages/ui/src/screens/{planet,map}/**` — real-data binding

**Tests:**

- TelemetryIndexer derivation tests against fixture repos
- XpLedger: patch-identity logic, revert detection
- Activity feed projection
- Planet/Map data binding

**User can do:**

- See real repo health on every planet
- Earn real XP on real merges
- Open Victory/Defeat ceremony for completed runs (opt-in)
- See activity feed populated with honest event history

---

### Phase 5 — Provider adapter materialization (2 weeks)

**Outcome:**

- Claude Code adapter materializes `.claude/skills/` etc. into sandbox/worktree (not committed)
- Codex adapter materializes `AGENTS.md` etc.
- Pi adapter materializes Pi's registry format
- Adapter conformance tests guarantee the provider-neutral deck materializes correctly across all 3
- Deck remains provider-neutral; only adapters know about provider quirks

**File scope:**

- `packages/control-core/src/adapters/{ClaudeCodeAdapter,CodexAdapter,PiAdapter}.ts`
- Conformance test harness in `packages/control-core/test/adapters/**`

**Tests:**

- Adapter golden tests: deck → provider files (snapshots)
- Cross-provider materialization tests
- Cleanup tests (no leftover provider files in worktree)

**User can do:**

- Run the same deck against Claude Code, Codex, or Pi cleanly
- Switch operative chassis (model/provider) without breaking the deck

---

### Phase 6 — Hosted-web transport extraction (2 weeks)

**Outcome:**

- HTTP/WS adapter cleanly factored from desktop bundle
- Stub `apps/web/` (optional, proof-of-path only) — same UI, different transport endpoint
- Existing desktop continues to work unchanged
- Architecture proven not Electron-locked

**File scope:**

- `packages/control-core/src/transport/{core-api,electron,http}/**`
- `apps/web/**` (optional)

**Tests:**

- Transport parity: same protocol works over both transports
- Regression tests guarding `@ai-hero/sandcastle` public API

**User can do:**

- Use desktop app normally
- (Optional) `npm run web:dev` to point the same UI at a remote control server

---

## 8. Risks (consolidated, top 12)

Ranked by severity × likelihood. Mitigations are integrated into the phase plan.

| #   | Risk                                                                                         | Source                | Mitigation                                                                                             |
| --- | -------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Worktree concurrency bugs block 5-parallel-run promise**                                   | gpt-5.5 (engine read) | `RepoRunCoordinator` in Phase 2; runId-based branch naming                                             |
| 2   | **AgentStreamEmitter too narrow for cockpit**                                                | gpt-5.5               | Widened in Phase 0 (additive, no breaking change)                                                      |
| 3   | **Renderer/control-core boundary going porous**                                              | gpt-5.4               | Strict `packages/protocol` enforcement; renderer never imports engine                                  |
| 4   | **Streaming N runs overwhelms renderer**                                                     | gpt-5.4 + gpt-5.2     | Server-side semantic events + RAF coalescing in renderer; no 100ms snapshots                           |
| 5   | **Cyberpunk aesthetic is unusable at scale (eye strain, motion sensitivity, accessibility)** | gpt-5.5               | Reduced-motion, high-contrast, font-scaling shipped in Phase 0                                         |
| 6   | **Breaking the published `@ai-hero/sandcastle` public API**                                  | gpt-5.5               | UI consumes engine through internal control adapter only; regression tests in Phase 6                  |
| 7   | **Provider adapter drift** (Claude/Codex/Pi conventions evolve independently)                | gpt-5.2               | Versioned adapters + conformance tests in Phase 5                                                      |
| 8   | **Game layer feels dishonest** (data faked or weak heuristics)                               | gpt-5.5               | XP/boss/terraform features defer to Phase 4 when real telemetry exists; show `unknown` states honestly |
| 9   | **XP gaming** (rebase tricks, dummy merges, revert loops)                                    | gpt-5.2 + gpt-5.5     | Patch-identity-keyed XP rule; revert-detection; cap per run                                            |
| 10  | **Cost / rate-limit visibility absent** when 5 parallel agents run                           | gpt-5.5               | Cost/budget panel in Phase 2; rate-limit aware backoff                                                 |
| 11  | **Desktop distribution tax** (macOS notarization, Windows SmartScreen)                       | gpt-5.2               | Defer signed installers until Phase 5; ship dev builds for early users                                 |
| 12  | **Effect-TS leaks into UI contributor experience**                                           | gpt-5.5               | Effect ends at the control server boundary; UI uses plain TS + zod                                     |

---

## 9. Open questions still pending

These weren't blockers for this plan but are worth answering as we approach the relevant phases.

1. **CI green-rate data source:** GitHub Actions API / local git inspection / webhook cache? _(Phase 4)_
2. **Issue source of truth:** GitHub mandatory in v1, or Beads pluggable? _(Phase 4)_
3. **QuestForge parser approach:** deterministic / rule-based first, or LLM-generated with human edit confirmation? _(Phase 3)_
4. **`galaxy.html` status:** shipping alternate home or reference-only? _(Phase 1; my recommendation: reference-only)_
5. **Intervention bar in v1:** which actions ship — pause, revise, retry phase, swap operative, abort, merge? _(Phase 2)_
6. **Hosted v2 model:** local-helper (browser controls user's machine) or remote sandboxes (service-owned)? _(Phase 6)_
7. **Telemetry write timing:** every event live, or batch on resolution? _(Phase 4; my recommendation: live with 250ms aggregation)_
8. **CLI coexistence:** desktop app launches existing `.sandcastle/main.ts` flows, or only the core `run()`/`interactive()` API? _(Phase 0; my recommendation: only core API in v1)_

---

## 10. What's NOT in this plan (explicit non-goals for v1)

- Hosted multi-tenant deployment with auth/sessions
- Mobile app
- Team-shared roster (operatives are user-local in v1)
- Real-money microtransactions for cosmetics
- Marketplace for community-contributed cards (feasible but Phase 7+)
- Voice / dictation directive input
- LLM-summarized run reports (Phase 5+)
- Plugin SDK for third-party UI extensions

---

## 11. Reviews ledger (preserved for traceability)

Three independent AI reviews fed this plan:

- **gpt-5.4 (Codex CLI MCP, fast mode, high effort)** — original plan with stack pick, 7 phases, data model. Recommended Electron-as-host. Self-review revealed Phase 1 was overscoped → introduced Phase 0.
- **gpt-5.2 (Codex CLI MCP, fast mode, high effort)** — second-opinion adversarial review. Pushed back on Electron-as-host (recommended daemon-first), 100ms IPC batching, JSONL telemetry. Flagged operative-state contradiction.
- **gpt-5.5 (Codex CLI MCP, fast mode, high effort)** — third-opinion adversarial review with full engine source-read. Found concrete worktree concurrency bugs in `WorktreeManager.ts`, narrow streaming surface in `AgentStreamEmitter.ts`. Provided shippable XP rule and concrete Phase 0 deliverable.

Full review transcripts in `.codex-run/`.

---

## 12. Next action

**Decision the team must take this week** (gpt-5.5's call):

> Lock the eight calls in §1 above. Specifically: confirm Phase 0 = Cockpit MVP, separate control process, split-state operatives, SQLite from day 1.

Once locked, **Phase 0 starts**. First commits should be:

1. `packages/protocol/src/events.ts` + `state.ts` (the wire format)
2. `src/AgentStreamEmitter.ts` widening (additive only)
3. `packages/control-core/src/server.ts` skeleton with one HTTP route + one WS channel
4. `apps/desktop/electron/main.ts` supervisor (spawn control + open window)
5. `apps/desktop/src/renderer/routes/runs.$runId.cockpit.tsx` minimum viable cockpit

End of week 1: control process boots, Electron loads UI, WS handshake works, no real run yet.
End of week 2: one real run streams from engine through control → WS → renderer timeline, cancellation works.
