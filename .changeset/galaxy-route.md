---
"@ai-hero/sandcastle": patch
---

internal: add a new `/galaxy` route — the strategic-overview "home" view. Three-rail layout (operative roster + climate filters · animated orbital galaxy · selected-planet detail). Fleshes out `GalaxySvgRenderer` with concentric rotating rings, climate-skinned planets (clear / warm / storm / live / idle), pulsing sun, and an optional transit-operative spark. Registers the route in both the web and desktop shells. No backend changes.
