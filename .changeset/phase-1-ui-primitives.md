---
"@ai-hero/sandcastle": patch
---

internal: phase 1 visual primitives — new `packages/ui` workspace (`@sandcastle/ui`) with the cyberpunk cockpit primitive system. Adds CSS-token entry (`@sandcastle/ui/tokens.css`), reduced-motion + high-contrast aware FX overlays (CrtRasterOverlay, FilmGrainOverlay, ChromaticHeadline), layout shells (OctaPanel, AppChrome), the persistent FleetDock + cells + MergeAllGreenButton, the deploy chord overlay, status pill, operative portrait + reactive tile, planet ortho-map and galaxy constellation SVG renderers, the 3 card views, and the run-event timeline. The Phase 0 desktop cockpit now consumes these from `@sandcastle/ui`; no public engine API change.
