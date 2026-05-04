import type { JSX } from "react";
import { useState } from "react";

interface ConnectScreenProps {
  readonly initialEndpoint?: string;
  readonly initialToken?: string;
  readonly error?: string | null;
}

/**
 * Minimal endpoint-entry form. Submits to the same URL with `?endpoint=`
 * and `?token=` query params — no persistence, no auth flow. v1 only.
 */
export function ConnectScreen(props: ConnectScreenProps): JSX.Element {
  const [endpoint, setEndpoint] = useState(props.initialEndpoint ?? "");
  const [token, setToken] = useState(props.initialToken ?? "");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedEndpoint = endpoint.trim().replace(/\/+$/, "");
    const trimmedToken = token.trim();
    if (!trimmedEndpoint || !trimmedToken) return;
    const params = new URLSearchParams();
    params.set("endpoint", trimmedEndpoint);
    params.set("token", trimmedToken);
    // Replace the URL so the app reboots with the new connection on the
    // next render. Using location.search ensures the SPA router reads it.
    window.location.search = `?${params.toString()}`;
  };

  return (
    <div className="connect-screen">
      <form className="connect-card" onSubmit={onSubmit}>
        <h1>Sandcastle · Connect</h1>
        <p className="hint">
          Point this build at a running control-core server. The bearer token
          appears in the supervisor terminal where{" "}
          <code>sandcastle control</code> was started.
        </p>
        <label>
          Endpoint URL
          <input
            type="url"
            inputMode="url"
            placeholder="http://127.0.0.1:5187"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            required
          />
        </label>
        <label>
          Bearer token
          <input
            type="text"
            placeholder="paste the token printed by control-core"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </label>
        {props.error ? <p className="error">{props.error}</p> : null}
        <div className="actions">
          <button type="submit">Connect</button>
        </div>
      </form>
    </div>
  );
}
