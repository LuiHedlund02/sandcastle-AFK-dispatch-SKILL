import type { JSX } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@sandcastle/transport";
import { StatusPill } from "@sandcastle/ui";
import type { Run } from "@sandcastle/protocol";

/**
 * Minimal fleet view for the web build — proves the same query shape
 * lands over the network. The desktop renderer has a much richer galaxy
 * UI; the web build re-renders the same data using the @sandcastle/ui
 * primitives. Phase 7+ would port the galaxy view too.
 */
export function FleetRoute(): JSX.Element {
  const apiClient = useApiClient();
  const fleetQuery = useQuery({
    queryKey: ["fleet"],
    queryFn: () => apiClient.getFleet(),
    refetchInterval: 5_000,
  });

  if (fleetQuery.isLoading && !fleetQuery.data) {
    return (
      <section className="web-route">
        <h1>Fleet</h1>
        <p className="placeholder">Charting the fleet…</p>
      </section>
    );
  }

  if (fleetQuery.error && !fleetQuery.data) {
    return (
      <section className="web-route">
        <h1>Fleet</h1>
        <p className="placeholder" role="alert">
          Could not reach control-core · {(fleetQuery.error as Error).message}
        </p>
      </section>
    );
  }

  const fleet = fleetQuery.data;
  if (!fleet) {
    return (
      <section className="web-route">
        <h1>Fleet</h1>
        <p className="placeholder">Waiting for first fleet snapshot…</p>
      </section>
    );
  }

  const runs: Run[] = fleet.dockOrder
    .map((id) => fleet.runsById[id])
    .filter((r): r is Run => Boolean(r));

  return (
    <section className="web-route">
      <h1>Fleet</h1>
      <p className="meta">
        capacity {fleet.capacity.used}/{fleet.capacity.max} ·{" "}
        {Object.keys(fleet.planetsById).length} planets · {runs.length} runs
      </p>
      <ul>
        {runs.length === 0 ? (
          <li>
            <span className="placeholder">No active runs.</span>
            <span />
          </li>
        ) : (
          runs.map((run) => {
            const planet = fleet.planetsById[run.planetId];
            return (
              <li key={run.id}>
                <span>
                  <strong>{planet?.repoName ?? run.planetId}</strong>
                  <br />
                  <small>
                    {run.id} · {run.directive}
                  </small>
                </span>
                <span
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <StatusPill status={run.status} />
                  <Link to={`/runs/${run.id}/cockpit`}>Open →</Link>
                </span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
