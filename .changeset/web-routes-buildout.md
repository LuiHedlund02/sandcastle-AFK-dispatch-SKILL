---
"@ai-hero/sandcastle": patch
---

internal: extract shared route components into a new `packages/screens/` workspace. Both the Electron desktop renderer and the hosted `apps/web/` build now import the same `AppChrome`, fleet store, query hooks, and screen components from `@sandcastle/screens`, bringing the web app to feature parity with the desktop. No public API change to `@ai-hero/sandcastle`.
