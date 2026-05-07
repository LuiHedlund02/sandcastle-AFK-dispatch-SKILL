# Phase 1 — Visual Primitives Dispatch

You are an Opus 4.7 subagent dispatched by the parent Claude session for Sandcastle Phase 1 frontend work. Your scope: build the **visual primitive library** that the 5 new Phase 1 screens (fleet, planet, planet map, quest-forge, roster, operative) will compose. The 5 screens are dispatched separately — you do **not** build them. You build the building blocks they need.

## Read first (in this order)

1. `docs/IMPLEMENTATION_PLAN.md` §7 (Phase 1) and §5 (repo layout — `packages/ui/` is target)
2. `docs/mockups/` — 12 HTML files. The visual ground truth. Open `index.html`, `cockpit.html`, `planet.html`, `roster.html`, `operative.html`, `quest-forge.html`, `fleet.html`, `galaxy.html`. Read the inline `<style>` blocks; the cyberpunk system is encoded there.
3. `apps/desktop/src/` — Phase 0 ad-hoc components and styles. **Migrate** the working Phase 0 dock/chord/status-pill into proper primitives; do not duplicate them.
4. `packages/protocol/src/state.ts` — type contracts you'll consume (Card, Deck, Planet, OperativeIdentity, Run, Phase, FleetState).
5. `apps/desktop/package.json` and `apps/desktop/electron.vite.config.ts` — to understand what's installed (React 19, Tailwind v4, lucide-react, framer-motion is NOT installed — flag if you need it).

## Outcome

A new internal workspace `packages/ui` with the cyberpunk primitive system. The Phase 1 screens (built by other subagents in parallel after you ship) import only from `@sandcastle/ui`. The Phase 0 cockpit keeps working.

## Hard rules

- **No public API change to `@ai-hero/sandcastle`.** `npm pack --dry-run` from repo root must still list 222 files.
- **No engine source changes** (no edits under `src/`).
- **No backend changes** (no edits under `packages/control-core/`, `packages/protocol/`).
- **Pure presentational components.** Primitives accept props and render. They do not fetch, do not call into Zustand/TanStack, do not own routing. The only stateful primitive is `DeployChordOverlay` (it owns its own controlled-vs-uncontrolled toggle, but the data lifecycle stays in the consumer screen).
- **TypeScript strict.** `npm run typecheck` from repo root must be green.
- **Tailwind v4** — use the same Tailwind setup as `apps/desktop/src/styles/`. CSS Modules for clip-paths and complex pseudo-element layering. Tokens live in `apps/desktop/src/styles/tokens.css` already; lift them into `packages/ui/src/tokens/tokens.css` and have the desktop app import from there going forward.
- **Reduced motion**: every motion / scanline / glow primitive must respect `@media (prefers-reduced-motion: reduce)` — degrade gracefully, no animation. This is a hard requirement from IMPLEMENTATION_PLAN §1 #8.
- **High contrast**: every overlay (CRT scanline, film grain, chromatic aberration) must hide under `@media (prefers-contrast: more)`.
- **Accessibility**: All interactive primitives have keyboard support, visible focus, ARIA labels.
- **Workspace deps**: use `"*"`, never `workspace:*`.
- **Don't commit.** Leave the working tree dirty.

## Layout to build

```
packages/ui/
  package.json                            # name: @sandcastle/ui, private, type: module, peerDeps: react/react-dom/lucide-react
  tsconfig.json                           # extends repo root; jsx: react-jsx
  tsconfig.build.json
  vitest.config.ts                        # smoke tests (jsdom OK if zero-cost)
  src/
    index.ts                              # barrel re-export
    tokens/
      tokens.css                          # color, type, motion, octagon clip-path tokens
      globals.css                         # base reset bits (move from desktop/styles/globals.css)
    fx/
      CrtRasterOverlay.tsx + .module.css  # absolute-positioned scanline overlay; reduced-motion safe
      FilmGrainOverlay.tsx + .module.css  # subtle noise; reduced-motion safe
      ChromaticHeadline.tsx + .module.css # text + ::before/::after offsets in cyan/magenta; high-contrast safe
    layout/
      OctaPanel.tsx + .module.css         # octagonal clip-path frame with optional eyebrow/header/footer slots
      AppChrome.tsx                       # SHELL only — provides FleetDock + DeployChordOverlay slots; takes props for callbacks (no router/store coupling)
    fleet/
      FleetDock.tsx + .module.css         # 88px bottom bar; takes runs[], capacity, connectionState, onDeploy, currentRunId
      FleetDockCell.tsx                   # one cell; status colored
      MergeAllGreenButton.tsx             # gated button
    deploy/
      DeployChordOverlay.tsx + .module.css # ⌘D / Ctrl+D overlay form; controlled (open/onOpenChange) + onSubmit({directive})
    operative/
      OperativePortrait.tsx + .module.css # the avatar/glyph (planet "π" or species mark)
      ReactiveOperativeTile.tsx           # avatar + name + chassis + status; pulses on activity
    planet/
      PlanetSvgRenderer.tsx               # ortho-map with continents/biomes from a Planet (deck/scars/wards/terraformStage)
    galaxy/
      GalaxySvgRenderer.tsx               # the constellation; takes Planet[]
    cards/
      CardFrame.tsx + .module.css         # the holographic frame all 3 card types share
      ModeCardView.tsx                    # render a ModeCard
      SkillCardView.tsx                   # render a SkillCard
      CommandCardView.tsx                 # render a CommandCard
    timeline/
      ToolTimelineCard.tsx                # one event row (text/tool.started/tool.finished/run.started/etc)
    status/
      StatusPill.tsx                      # MIGRATE from desktop; same export shape so the Phase 0 cockpit keeps working
```

## Mockup → primitive mapping

Each primitive must reproduce the look from these mockups. Don't blindly copy CSS — extract reusable tokens and let the components compose. Specifically:

| Primitive                | Mockup source(s)                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------- |
| OctaPanel                | `cockpit.html` `.panel`, `roster.html` `.dossier`, `operative.html` `.profile-card` |
| FleetDock + Cell         | `index.html` `.sc-dock`, every screen's persistent dock                             |
| DeployChordOverlay       | `index.html` `.sc-chord-bg` + `cockpit.html` deploy form                            |
| OperativePortrait + Tile | `roster.html` `.operative-tile`, `operative.html` `.profile-portrait`               |
| PlanetSvgRenderer        | `planet.html` (the SVG ortho-map with terminator + continents)                      |
| GalaxySvgRenderer        | `galaxy.html` constellation                                                         |
| CardFrame + 3 views      | `quest-forge.html` `.card`, `cockpit.html` deck strip                               |
| CrtRasterOverlay         | every screen, the subtle scanline layer                                             |
| FilmGrainOverlay         | every screen, the noise layer                                                       |
| ChromaticHeadline        | every `<h1>` with the cyan/magenta offset                                           |

## Migration: Phase 0 desktop app

After your work, edit `apps/desktop/src/`:

- Add `@sandcastle/ui: "*"` to `apps/desktop/package.json` deps
- Replace `apps/desktop/src/AppChrome.tsx`, `primitives/FleetDock.tsx`, `primitives/DeployChordOverlay.tsx`, `primitives/StatusPill.tsx` with imports from `@sandcastle/ui`
- The `apps/desktop/src/primitives/CockpitTimeline.tsx` can stay desktop-local for now (Phase 0 specific), OR migrate it to `packages/ui/src/timeline/CockpitTimeline.tsx` if it's identical to ToolTimelineCard's purpose — your call, but keep the cockpit working.
- Move shared tokens from `apps/desktop/src/styles/tokens.css` into `packages/ui/src/tokens/tokens.css`; have the desktop app import them via `@sandcastle/ui/tokens.css` (or whatever export you choose)

The cockpit run flow (deploy → timeline → cancel/complete) **must still work** after migration. Boot the desktop app at the end and confirm.

## Tailwind v4 wiring

Tailwind v4 uses CSS-first config. The desktop app already imports Tailwind via `apps/desktop/src/styles/globals.css`. Make sure UI primitives' Tailwind classes (utility-only, no custom theme tokens) compose with the desktop's Tailwind setup. The custom design tokens (`--sc-cyan`, octagon clip-path, etc.) live in CSS custom properties in `tokens.css` so they work without Tailwind config changes.

## Tests

Smoke tests only — render-shape sanity, not visual diffs. Use `@testing-library/react` if you need it (add to devDeps). At minimum:

```
packages/ui/test/
  OctaPanel.test.tsx           # renders eyebrow/header/footer slots
  FleetDock.test.tsx           # renders cells from a fixture runs[], onDeploy fires
  DeployChordOverlay.test.tsx  # opens/closes, submit calls onSubmit with trimmed directive
  StatusPill.test.tsx          # all 10 statuses render
  CardFrame.test.tsx           # 3 card types render
```

## Verification you must run before reporting done

- [ ] `npm run typecheck` from repo root — green across all workspaces
- [ ] `npm test -w @sandcastle/ui` — all green
- [ ] `npm run build -w @sandcastle/desktop` — green
- [ ] `npm pack --dry-run` from repo root — still 222 files
- [ ] `npm run dev:desktop` boots, the cockpit window opens, deploy chord still works, timeline renders, cancel still works (golden path through your migrated primitives)

If you can't run a step due to environment issues, say so explicitly. **Do not** claim verification you didn't run.

## Open decisions you may resolve

1. **Framer Motion** — not in package.json. If you need it for OperativePortrait pulse / chord-overlay enter, add it to `@sandcastle/ui` peerDeps and to desktop deps. Otherwise use CSS keyframes (probably better for this round; primitives stay framework-light).
2. **Card body markdown rendering** — Phase 1 deck loader returns `body` as raw markdown. Either render with a small markdown lib (add `marked` or `markdown-to-jsx`) or render `<pre>{body}</pre>` for now. v1 can be `<pre>` — flag the deferral.
3. **PlanetSvgRenderer terraform staging** — the mockup shows terraformStage 0..5 affecting how lit / detailed the planet is. Implement at least 3 visual stages; document the rest as TODO.
4. **GalaxySvgRenderer interactivity** — for primitives, just render. The screen subagent can wire click-to-navigate.

## Deliverable

Working tree dirty:

- `packages/ui/` populated and tested
- `apps/desktop/` migrated to consume `@sandcastle/ui`
- Cockpit smoke-tested in a real Electron boot
- A summary report listing: files created, what was migrated, verification results, open items, any deviations.

Stop and ask before introducing breaking changes to the Phase 0 cockpit. Otherwise, proceed without checkpoints.
