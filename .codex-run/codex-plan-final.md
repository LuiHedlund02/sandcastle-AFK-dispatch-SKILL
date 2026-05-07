# Codex's plan (final, post-self-review)

This is the plan produced by gpt-5.4 for the Sandcastle UX expansion.
Original prompt: see `.codex-run/dispatch-prompt.md`.

## Stack pick: Electron + React + Vite, Effect engine retained

- **App shell:** Electron (NOT Tauri, NOT Next.js, NOT pure web+daemon for v1)
- **Frontend:** React 19 + electron-vite + React Router 7
- **State:** Zustand (live fleet) + TanStack Query (request/cache)
- **Styling:** Tailwind v4 + CSS Modules + Framer Motion
- **IPC:** typed Electron IPC, Zod-validated, **batched at 100ms / 10Hz from day 1**
- **Persistence split:**
  - **Repo-local canonical:** `.sandcastle/{planet.json,deck.json,agents.md,skills/*.md,commands/*.md,telemetry/{activity.jsonl,metrics.json,runs/*.json}}`
  - **Global canonical:** `~/.sandcastle/operatives/<operativeId>.json`

## Why these rejections

- **Tauri:** wrong tradeoff — the hard part is privileged local orchestration, not binary size. Adds a Rust boundary where TS+Effect+Node already wins.
- **Next.js docs app extension:** docs is marketing surface; cockpit is long-lived local control surface; SSR is wrong center of gravity.
- **Web + local daemon (v1):** right v2 deployment, wrong v1 product. Adds auth/daemon-lifecycle/port-management before UX validation.

## Architecture (process model)

```
Renderer (React) -> Preload (typed bridge) -> Main (IPC host)
                                               -> packages/control-core
                                                   -> @ai-hero/sandcastle engine (Effect)
                                                       -> sandbox providers
```

- Renderer never imports the engine — typed protocol package only
- Main/control-core authoritative for run state; renderer state is a projection
- 100ms snapshot batching from day 1; critical transitions flush instantly
- Append-only `activity.jsonl` per repo + denormalized derived snapshots

## Mockup → component mapping

```
apps/desktop/electron/{main.ts, preload.ts}
apps/desktop/src/renderer/routes/
  __root.tsx                          -> packages/ui/src/layout/AppChrome.tsx
  index.tsx                           -> MockupIndexScreen.tsx
  fleet.tsx                           -> FleetScreen.tsx
  galaxy-reference.tsx                -> GalaxyReferenceScreen.tsx
  planet.$planetId.tsx                -> PlanetScreen.tsx
  planet.$planetId.map.tsx            -> PlanetMapScreen.tsx
  quest-forge.tsx                     -> QuestForgeScreen.tsx
  runs.$runId.cockpit.tsx             -> CockpitScreen.tsx
  runs.$runId.combat.tsx              -> CombatScreen.tsx
  runs.$runId.victory.tsx             -> VictoryScreen.tsx
  runs.$runId.defeat.tsx              -> DefeatScreen.tsx
  roster.tsx                          -> RosterScreen.tsx
  operatives.$operativeId.tsx         -> OperativeScreen.tsx
```

## Shared primitives (live in `packages/ui/src/primitives/`)

- `fleet/{FleetDock,FleetDockCell,MergeAllGreenButton}`
- `deploy/{DeployChordOverlay,DeployChordParserPreview}`
- `operative/{ReactiveOperativeTile,OperativePortrait}`
- `planet/PlanetSvgRenderer`
- `galaxy/GalaxySvgRenderer`
- `cards/{CardFrame,ModeCardView,SkillCardView,CommandCardView}`
- `timeline/ToolTimelineCard`
- `fx/{CRTRasterOverlay,FilmGrainOverlay,ChromaticHeadline}`
- `layout/OctaPanel`

`AppChrome` is a global persistent shell containing FleetDock + DeployChordOverlay so they truly live everywhere (not duplicated per page).

## Data model (selected)

```ts
type ProviderId = "claude-code" | "codex" | "pi" | "opencode";
type CardType = "mode" | "skill" | "command";
type RunStatus = "queued" | "starting" | "casting" | "striking" | "verifying"
               | "win-pending" | "fail-pending" | "victory" | "defeat" | "aborted";
type OperativeMicroState = "idle" | "casting" | "striking" | "crit" | "hit";

interface Card { id; type; slug; title; summary; sourcePath; enabled; tags; body; updatedAt; }
interface Deck { version: 1; mode: ModeCard; skills: SkillCard[]; commands: CommandCard[]; order: string[]; }
interface Operative { id; codename; provider; model; species; className; chassis;
                       level; xp; bond; streak; concurrencyCap; activeRunIds[]; sleeveCardIds[]; ... }
interface Planet { id; repoName; repoRoot; defaultBranch; terraformStage; scars[]; wards[]; deck; telemetry; activeRunIds[]; lastRunAt; }
interface Run { id; planetId; operativeId; provider; sandboxProvider; status; directive; branch;
                worktreePath?; startedAt; endedAt; phaseIds[]; currentPhaseId;
                verification: {allGreen, failedChecks[]}; totals: {...}; }
interface Phase { id; runId; ordinal; title; directiveSlice; objective; xpEstimate;
                  verifyRules[]; status; startedAt; endedAt; }
type ActivityEvent = run.started | run.status-changed | phase.updated | tool.called | intervention.used | run.resolved
interface FleetState { planetsById; operativesById; runsById; phasesById; dockOrder[];
                       pendingDecisions[]; capacity: {used,max}; updatedAt; }
```

## Provider adapter (canonical: `.sandcastle/`; provider-specific = sandbox-local materialization)

```ts
interface AgentProviderAdapter {
  id: "claude-code" | "codex" | "pi";
  materialize(input: ProviderAdapterInput): Promise<{
    files: ProviderMaterializedFile[];
    env?: Record<string, string>;
    promptPrelude?: string;
    cleanupPaths?: string[];
  }>;
}
```

Generated provider files (e.g. `.claude/skills/`, `AGENTS.md`) are materialized **inside the sandbox/worktree**, never committed. Deck stays provider-neutral.

## Implementation phases (revised after self-review)

| Phase                                            | Scope                                                                                                                                                             | Time         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **0 — Clickable shell over one repo**            | Electron+Vite boots, opens 1 repo manually, 3 routes (fleet/planet/quest-forge), reads `.sandcastle/` deck, dock+deploy stubs, 1 panel + 1 overlay primitive only | **~2 weeks** |
| **1 — Read-only fleet/planet/roster/operative**  | Repo registry, 7 routes, full visual primitives, basic git telemetry                                                                                              | 2 weeks      |
| **2 — First live run: dock + cockpit streaming** | One real `run()` from UI, persistent dock, reactive operative tile, IPC contract sealed                                                                           | 2 weeks      |
| **3 — Deploy chord + multi-project parallel**    | ⌘D global, multi-target deploy, focus-budget enforcement, mini decision cards                                                                                     | 2 weeks      |
| **4 — Quest Forge + phases + combat**            | Directive→phases parser, combat re-skin, real phase tracking                                                                                                      | 2 weeks      |
| **5 — Telemetry + planet/map/victory/defeat**    | Coverage, CI, churn, issues become real; outcome screens data-backed                                                                                              | 2–3 weeks    |
| **6 — Provider adapters + transport extraction** | Claude Code / Codex / Pi materialization formalized; HTTP transport stub for v2                                                                                   | 2 weeks      |

Total: ~14–15 weeks for one engineer.

## Risks (top 5)

1. Renderer/control-core boundary going porous → strict `packages/protocol` enforcement
2. Streaming N runs overwhelming renderer → main-side projection + 100ms batching
3. Cross-project operative state ambiguity → **resolved: global at `~/.sandcastle/operatives/`**
4. Mockup fidelity → CSS swamp → primitives in Phase 0, no per-screen FX duplication
5. Telemetry accuracy time-sink → ship `unknown` states first, cache derivations

## Codex's stated uncertainties

1. Hosted-web path shape (transport-agnostic now vs hosted-first)
2. Quest Forge parser implementation (rule-based vs LLM-generated)
3. Telemetry source quality (CI green-rate, issue mapping)
4. Exact provider materialization format for Codex/Pi
5. Whether `deck.json` is needed in v1 or can be inferred from filesystem
6. Whether all 12 routes should be built early (they shouldn't)

## Open questions (top 10)

1. Operative roster truly global or repo-portable?
2. CI green-rate data source: GitHub Actions / local git / webhook cache?
3. Issue source of truth: GitHub mandatory or pluggable Beads?
4. Quest Forge parser: deterministic or LLM-generated with confirm?
5. `galaxy.html` status: shipping alternate home or reference only?
6. Intervention bar in v1: which actions mandatory?
7. Concurrent runs targeting same default branch: isolation + queueing?
8. Hosted v2: local-helper or remote sandboxes?
9. Telemetry write timing: per-event or per-resolution?
10. Desktop launches existing `.sandcastle/main.ts` or only `run()`/`interactive()`?
