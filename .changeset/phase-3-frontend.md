---
"@sandcastle/ui": patch
"@sandcastle/desktop": patch
---

Phase 3 frontend slice: combat-skin primitives (CombatStage, PhaseRound,
AttackRoll, SavingThrow, CombatHud) with reduced-motion / high-contrast
guards, structured QuestForge phase editor primitives (PhaseEditorList,
PhaseEditorCard with verify-rule chip parsing), parseQuestForge +
engageQuestForge API client + queries (useQuestForgeParse debounced 300ms,
useEngageQuestForge mutation), the new /runs/:runId/combat route, a
"Combat view" link in the cockpit header, and a rewired /quest-forge route
that drives the real backend parser and dispatches phased runs into the
combat view.
