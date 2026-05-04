---
"@ai-hero/sandcastle": patch
---

Phase 6 transport extraction: factor the renderer's transport layer
(`apiClient` + `connectFleetSocket`) into a new `@sandcastle/transport`
workspace, migrate the desktop renderer to consume it via a
`<TransportProvider>` + `useApiClient()` / `useFleetSocket()` hooks, and
introduce a `@sandcastle/web` workspace that boots the same UI primitives
against a remote control-core via `?endpoint=&token=` query params. Public
API of `@ai-hero/sandcastle` is unchanged and now pinned at 222 files by a
new regression test.
