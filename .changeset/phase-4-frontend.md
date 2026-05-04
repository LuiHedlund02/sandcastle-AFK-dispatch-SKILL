---
"@sandcastle/ui": patch
"@sandcastle/desktop": patch
---

Phase 4 frontend slice: ceremony primitives (VictoryStage, DefeatStage,
XpDeltaBadge, ConfettiSpray, ActivityFeed) with reduced-motion guards on
confetti and the XP-delta animation; honest null-safe TelemetryGrid +
OperativeXpStrip primitives; new desktop routes /runs/:runId/victory and
/runs/:runId/defeat; planet route now binds the live coverage / CI / issues
/ churn telemetry through TelemetryGrid and adds a Recent activity panel
backed by the new useActivity hook; operative dossier surfaces totalXp +
recent merges via OperativeXpStrip; AppChrome flashes a +N XP badge when a
merge decision returns a positive xpDelta and routes win-pending merges to
the victory ceremony / fail-pending discards to the defeat ceremony.
