import type { JSX } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@sandcastle/transport";
import { StatusPill } from "@sandcastle/ui";

/**
 * Minimal cockpit view for the web build. Same query shape as the
 * desktop's `useRun` — refetched with the same intervals. The full
 * timeline view (`<RunTimeline>`) is desktop-only in v1; the web
 * shell shows status + directive + summary so we can prove the
 * connection round-trips a real run.
 */
export function CockpitRoute(): JSX.Element {
  const { runId } = useParams();
  if (!runId) return <Navigate to="/fleet" replace />;
  return <CockpitContent runId={runId} />;
}

function CockpitContent({ runId }: { readonly runId: string }): JSX.Element {
  const apiClient = useApiClient();
  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => apiClient.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "victory" || status === "defeat" || status === "aborted"
        ? false
        : 2_000;
    },
  });

  if (runQuery.isLoading && !runQuery.data) {
    return (
      <section className="web-route">
        <h1>Run · {runId}</h1>
        <p className="placeholder">Loading…</p>
      </section>
    );
  }

  if (runQuery.error && !runQuery.data) {
    return (
      <section className="web-route">
        <h1>Run · {runId}</h1>
        <p className="placeholder" role="alert">
          Run not found: {(runQuery.error as Error).message}
        </p>
      </section>
    );
  }

  const run = runQuery.data;
  if (!run) {
    return (
      <section className="web-route">
        <h1>Run · {runId}</h1>
        <p className="placeholder">Waiting for run snapshot…</p>
      </section>
    );
  }

  return (
    <section className="web-route">
      <h1>{run.directive}</h1>
      <p className="meta">
        <StatusPill status={run.status} /> · run {run.id} · planet{" "}
        {run.planetId}
      </p>
      <p style={{ marginTop: 12, color: "var(--mist)" }}>
        Operative: <strong>{run.operativeId}</strong>
      </p>
      <p style={{ marginTop: 8 }}>
        <Link to="/fleet">← Back to fleet</Link>
      </p>
    </section>
  );
}
