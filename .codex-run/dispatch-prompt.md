# Sandcastle — Technical Implementation Plan Request

You are advising on the technical stack and implementation plan for a major UX
expansion of an existing TypeScript CLI library. We need framework/language
recommendations, architecture trade-offs, and a phased build plan that gets us
from the current CLI to a rich, distinctive UI without throwing away the engine
that already works.

<output_contract>
Return a structured technical plan in markdown, organized as:

1. STACK RECOMMENDATION — pick a single primary stack and justify it. Concrete
   choices: app shell, frontend framework, build tool, state management,
   styling/animation, IPC/transport, persistence. Compare against ≥2 alternatives
   we considered (see "stack candidates" below) and explain when each would lose.
2. ARCHITECTURE — a one-page diagram (ascii is fine) showing how the new UI
   layer talks to the existing TypeScript Effect engine, sandbox providers, and
   per-project `.sandcastle/` config. Address: process model, IPC, run streaming,
   live reactive state, multi-project parallel runs, persistence.
3. SCREEN → COMPONENT MAPPING — map each of the 12 mockups to concrete component
   files/paths under the chosen stack.
4. SHARED PRIMITIVES — list the cross-screen components (fleet dock, deploy chord,
   reactive operative tile, planet/galaxy SVG renderers, animated cards, CRT/grain
   overlay) and where they live.
5. DATA MODEL — TypeScript types/interfaces (or zod schemas) for: Operative,
   Planet, Run, Phase, Card (mode/skill/command), Deck, ActivityEvent,
   FleetState. Just the shapes, not the implementations.
6. PROVIDER ABSTRACTION — confirm/refine our `.sandcastle/` directory shape so
   the deck (mode/skills/commands) is provider-neutral and adapts to Claude Code,
   Codex, Pi, etc. Include the adapter interface.
7. IMPLEMENTATION PLAN — phased, with concrete milestones. Each phase should
   list: outcome, file scope, tests to add, what the user can do at the end of
   that phase. Aim for ≤6 phases that build on each other.
8. RISKS — top 5 technical risks with mitigations.
9. OPEN QUESTIONS — things you'd want answered before you start writing code.
   Format: markdown with clear headers. Code blocks for type definitions, file
   trees, and ASCII architecture diagrams. Be opinionated; "it depends" answers
   are not useful.
   </output_contract>

<completeness_contract>
Task is complete when ALL of these are present in the response:

- [ ] One clear stack recommendation with justification
- [ ] At least one explicit "we should NOT use X because Y" call
- [ ] An architecture diagram showing process model + IPC
- [ ] All 12 mockup screens mapped to concrete component files
- [ ] All shared primitives listed with file paths
- [ ] TypeScript type definitions for all 8 listed entities
- [ ] Adapter interface for Claude Code / Codex / Pi providers
- [ ] 5–6 phases, each with outcome + file scope + tests + user-visible result
- [ ] 5 ranked risks with mitigations
- [ ] 5+ open questions
      Do not stop until every item above is covered. No placeholders or "TBD".
      </completeness_contract>

<context>

## What Sandcastle is today (DO NOT THROW AWAY)

Sandcastle is a published TypeScript library + CLI on npm as
`@ai-hero/sandcastle`. The engine already works. It orchestrates AI coding
agents (Claude Code, Codex, Pi) inside isolated sandboxes (Docker, Podman,
Vercel, Daytona) on a per-project basis.

Existing stack (see @package.json):

- TypeScript (strict), ES modules
- Effect-TS (`effect`, `@effect/platform`, `@effect/platform-node`,
  `@effect/cli`, `@effect/printer`, `@effect/printer-ansi`)
- `@clack/prompts` for terminal UX
- Vitest for tests
- `tsgo` (TypeScript native preview) for type-check + build
- npm package manager
- prettier, husky, lint-staged
- Sandbox providers as separate sub-modules under `src/sandboxes/`
  (`docker`, `podman`, `vercel`, `daytona`, `no-sandbox`) re-exported via
  the package.json `exports` map

Existing source structure (selected highlights from src/):

- `main.ts` (Effect-based CLI entry — see @src/main.ts)
- `cli.ts` (commander-equivalent via `@effect/cli`)
- `Orchestrator.ts`, `SandboxLifecycle.ts`, `SandboxFactory.ts`,
  `SandboxProvider.ts`
- `WorktreeManager.ts`, `CopyToWorktree.ts`, `createWorktree.ts`
- `AgentProvider.ts`, `AgentStreamEmitter.ts`
- `SessionStore.ts`, `SessionPaths.ts`
- `InitService.ts` (scaffolds `.sandcastle/` dir per project)
- `interactive.ts`, `Display.ts`, `terminalCleanup.ts`
- `EnvResolver.ts`, `MountConfig.ts`, `mountUtils.ts`
- `PromptResolver.ts`, `PromptArgumentSubstitution.ts`,
  `PromptPreprocessor.ts`, `RecoveryMessage.ts`
- `templates/` (init scaffolds), `sandboxes/` (provider impls)

There is also a small Next.js docs site under `docs/` (Fumadocs-based) that
already exists for marketing/docs and is not the target of the new UX.

Per-project state today lives in `.sandcastle/` at the user's repo root:

- `.sandcastle/prompt.md`
- `.sandcastle/.env`
- `.sandcastle/main.ts` (user's entry)

We have agreed `.sandcastle/` will also hold (provider-neutral):

```
.sandcastle/
├── pet.json              # planet identity, terraform stage, scars/wards
├── agents.md             # MODE card content (operating mode, constraints)
├── skills/*.md           # SKILL cards (passive expertise, frontmatter + body)
└── commands/*.md         # SLASH-COMMAND cards (active workflows)
```

These files are provider-neutral. A small adapter layer translates them at
run time into whatever the dispatched agent expects (Claude Code's
`.claude/skills/`, Codex's `AGENTS.md`, Pi's registry, etc).

## What we are adding (the UX layer)

We have 12 designed mockups in `docs/mockups/` that define a rich,
distinctive UI for this engine. The mockups are static HTML in a heavy
cyberpunk-cockpit aesthetic (warm void palette + cyan/magenta neon, CRT
scanlines, kanji watermarks, octagonal clip-path panels, Chakra Petch +
JetBrains Mono fonts, chromatic aberration on key headlines). The UX layer
includes a game-loop (planets terraforming, operatives leveling up, boss
fights = real run telemetry).

The 12 mockups (each is a self-contained HTML file at `docs/mockups/X.html`):

1. **index.html** — vision-deck navigator linking the other 11 with previews
2. **fleet.html** — galaxy view (HOME); shows sun, planets, fleet dock,
   ⌘D deploy chord overlay
3. **galaxy.html** — earlier galaxy variant (kept for reference)
4. **planet.html** — single-project ortho-map (real SVG globe with
   continents, latitude/longitude graticule, terminator shadow, atmosphere
   rim, planted operative beacon, HUD-pinned annotations); right rail with
   the deck (mode + skills + commands) and `.sandcastle/` file preview
5. **map.html** — region/dungeon view of one planet (issues as monsters,
   tests as wards, fog of war over neglected dirs)
6. **quest-forge.html** — directive → phases parser. User types a plan,
   it's decomposed into phases inline with colored highlights; right pane
   shows the extracted phases with XP estimates and verify rules; engage
   → goes to combat
7. **cockpit.html** — live agent run view (run banner, streaming tool
   cards as a timeline of think/bash/edit/read steps, reactive operative
   tile in the corner showing 5 micro-states: idle/casting/striking/crit/hit)
8. **combat.html** — phase-by-phase fight; turn-based combat-log re-skin of
   the cockpit timeline; left-rail combatants (player HP/Focus/Shield, boss
   HP/Rage), right-rail quest objectives + original directive + totals;
   bottom command bar with operator-intervention buttons
9. **victory.html** — boss-down moment; plasma-green radial rings, level-up
   ribbon, ascension unlock, loot drops, decision bar (replay/revise/discard/
   merge-to-main)
10. **defeat.html** — dark mirror of victory; CRT distortion, hazard tape,
    cause-of-death pinned, partial credit shown, salvage/lessons/worktree-
    preserved, recovery actions (replay/swap-operative/revise-plan/abandon/
    re-engage)
11. **roster.html** — full roster of operatives (Pi, Codex, Claude, Scout,
    benched Gemini); pick → operative.html
12. **operative.html** — single operative deep-dossier; layered SVG cyborg
    portrait (head/torso/arms/aura, kanji chestplate, scalpel for Surgeon
    class), 84px chromatic-aberration codename, level/XP, travel log
    (mini-planet thumbs + win/loss per planet), personal sleeve of cards,
    bond meter with unlocks, chassis swap (model swap as ceremony), action
    rail (deploy/recall/rename)

Universal across all 12 (already injected): an 88px **fleet dock** at the
viewport bottom showing every active run as a cell with mini-portrait + planet

- phase + progress + status (casting/striking/boss/win-pending/fail-pending).
  A `Merge all green ⌘⇧M` button gated behind all-green verification. A
  `Deploy ⌘D` primary button opening a chord overlay where the user types
  "deploy [operative] to [planet, planet, planet] · [directive]" — multi-target
  parallel deployment is a first-class action. The dock shows fleet-budget
  ("3/5 π") because each operative has a per-level concurrency cap.

## Conceptual model (LOCKED)

- **Planet** = project (per-repo). Owns `.sandcastle/` config + deck.
  Terraforms slowly based on coverage/CI/age. Doesn't level up. Doesn't have
  feelings. It's the _world_.
- **Operative** = user's pet (cross-project). Owns level, bond, personal
  sleeve, identity (species + class + chassis = backing model). Travels
  between planets. Levels by merging. Bonds via operator interventions.
- **Galaxy = home screen**, not the cockpit.
- **Parallel runs are the default**. Same operative can be deployed to N
  planets simultaneously up to focus budget.
- **Game feedback never interrupts**. XP/levels/loot accumulate; full
  Victory/Defeat screens are opt-in (clicking the dock cell). Mini decision
  cards pop up from win-pending cells with one-click `Merge` or `Revise`.

## Stack candidates we have considered

You should weigh these and pick one (or hybrid). Be opinionated.

- **A. Tauri + React (Vite)** — Rust shell, web frontend, native packaging.
  Small binaries, no Chromium overhead. Good for a desktop-first product.
- **B. Electron + React (Vite)** — what Pi Code uses (we have the source
  in mind as reference). Bigger binary, better Node-ecosystem story (we're
  already deep in Node/TS).
- **C. Web app (Next.js)** — extend the existing Fumadocs site, or a new
  Next.js app. SSR friendly. No installer. Worse for filesystem access.
- **D. Web app (Vite + React, no SSR)** that talks to a local Sandcastle
  daemon process. Browser as the UX surface; CLI engine still owns the
  filesystem. Auth/sessions matter.
- **E. Pure terminal UI** (extend existing Ink/Clack/Effect stack). Cheap.
  Cannot deliver the cyberpunk mockup aesthetic. We've ruled this out for
  the new UX, BUT — the existing CLI must keep working for headless/CI use.

## Existing engine constraints

- Already published as `@ai-hero/sandcastle` on npm. Do not break the public
  API (`run()`, `interactive()`, `wt.run()`, `wt.interactive()`,
  `createSandbox()`, sandbox provider modules).
- Effect-TS is load-bearing in the engine. We do NOT want to rip Effect
  out. Frontend can be non-Effect; the engine stays Effect.
- Multi-project parallel runs are mandatory. The new UI must surface live
  status of N concurrent runs without modal-blocking the user.
- Sandbox providers are pluggable today. New UI must not assume a specific
  provider.

## Game-loop telemetry (drives the UI)

All numbers visible in the mockups must be backed by real data:

- Coverage % (vitest coverage), CI green-rate (last 30 days from git or CI
  webhook), open issues (GitHub/Beads issues — Sandcastle already has Beads
  integration in `docs/agents/issue-tracker.md`), churn (`git log` per
  directory), age (first commit), test counts (existing test files).
- XP accrues on merges. Penalties on reverts. Streaks tracked. Bond stat
  driven by operator interventions during runs.
- "Boss fights" map to GitHub issues. "Wards" map to test files.
- All persisted to `.sandcastle/` so it travels with the repo.

</context>

<task>

Produce the technical implementation plan per the output contract above.

Be opinionated. Pick ONE stack. Tell us what NOT to use. Make the phases
concrete enough that someone could start phase 1 tomorrow without further
clarification. Do not generalize across "framework X or Y" — make the call.

The team's biases (state if you disagree):

- We do not want to throw away the Effect engine.
- We want the new UX shippable as both a desktop app AND optionally a
  hosted web app (multi-tenant in v2). Pick a stack that doesn't paint us
  into a corner.
- We want fast iteration — Vite-style HMR is a hard requirement.
- We want React (the team is most fluent there). Don't propose Solid/Svelte
  unless there's a strong reason.
- We want to ship phase 1 in ~2 weeks of one engineer's effort.

Optional but valued: where the ⌘D deploy chord, fleet dock, and reactive
operative tile fit into the component tree as shared primitives so they
truly live everywhere (not duplicated per page).

</task>

<verification>
After producing the plan: list any commands you would run to verify the plan
is internally consistent (typecheck commands, lint commands, build commands
that should exist post-phase-1). You don't need to run anything yourself —
this is an advisory dispatch.
</verification>
