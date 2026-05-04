# @sandcastle/web

Browser build of the Sandcastle renderer — the same UI primitives the Electron
desktop app uses, pointed at a remote control-core server. Phase 6 ships this
to prove the architecture is not Electron-locked.

## Run it locally

```bash
npm run dev:web      # boots Vite on http://localhost:5174
```

Visit `http://localhost:5174/?endpoint=<base>&token=<t>` to connect — for
example, against a local control-core started via
`npm run control-core:dev`:

```
http://localhost:5174/?endpoint=http://127.0.0.1:5187&token=PASTE_TOKEN_HERE
```

If you skip the query parameters the app shows a Connect form where you can
paste an endpoint URL + bearer token. There is **no persistence** in v1 —
reload the page and you'll get the form again.

## What ships in v1

- `/fleet` — fleet snapshot, polled via the same `getFleet` query the desktop
  uses.
- `/runs/:runId/cockpit` — minimal run cockpit (status + directive + meta).

The full galaxy view, deploy chord, dock, quest-forge, planet, and roster
screens render placeholders here. They will be ported in Phase 7+ once the
hosted-mode CORS/auth story is settled.

## CORS

The control-core server validates requests via the `Authorization: Bearer`
header. Hosting it behind a domain that the browser can reach cross-origin
is currently out of scope — if your browser refuses, run the control server
on the same origin (e.g. via a reverse proxy) or run both on `localhost`
during development.
