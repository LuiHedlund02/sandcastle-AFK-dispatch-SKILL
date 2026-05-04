import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import {
  AppChrome as AppChromeShell,
  DeployChordOverlay,
  FleetDock,
  type FleetConnectionState,
} from "@sandcastle/ui";
import type { Run } from "@sandcastle/protocol";
import { connectFleetSocket } from "./api/ws";
import { useCreateRun } from "./api/queries";
import { useFleetStore } from "./state/fleetStore";

const mapConnectionState = (
  state: "connecting" | "connected" | "closed",
): FleetConnectionState => (state === "connected" ? "open" : state);

export function AppChrome(): JSX.Element {
  const [deployOpen, setDeployOpen] = useState(false);
  const setConnectionState = useFleetStore((state) => state.setConnectionState);
  const fleet = useFleetStore((state) => state.fleet);
  const connectionState = useFleetStore((state) => state.connectionState);
  const { runId } = useParams();
  const navigate = useNavigate();
  const createRun = useCreateRun();

  useEffect(() => {
    const disconnect = connectFleetSocket(
      window.sandcastle,
      useFleetStore.getState().applyServerMessage,
    );
    return disconnect;
  }, []);

  useEffect(() => {
    const open = (): void => setDeployOpen(true);
    const keydown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDeployOpen(true);
      }
    };

    window.addEventListener("sandcastle:open-deploy", open);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("sandcastle:open-deploy", open);
      window.removeEventListener("keydown", keydown);
      setConnectionState("closed");
    };
  }, [setConnectionState]);

  const runs: Run[] = fleet
    ? fleet.dockOrder
        .map((id) => fleet.runsById[id])
        .filter((r): r is Run => Boolean(r))
    : [];

  const handleDeploySubmit = ({ directive }: { directive: string }) => {
    createRun.mutate(
      { directive },
      {
        onSuccess: ({ runId: createdId }) => {
          setDeployOpen(false);
          navigate(`/runs/${createdId}/cockpit`);
        },
      },
    );
  };

  return (
    <AppChromeShell
      contextLabel={
        <>
          <span style={{ fontFamily: "var(--sc-display)", fontWeight: 700 }}>
            Sandcastle
          </span>
          <span
            style={{
              border: "1px solid var(--sc-rule-2)",
              background: "var(--sc-hull-1)",
              color: "var(--sc-mist)",
              padding: "3px 8px",
              fontSize: 11,
            }}
          >
            Cockpit MVP
          </span>
        </>
      }
      right={
        <span
          style={{
            border: "1px solid var(--sc-rule-2)",
            background: "var(--sc-hull-1)",
            color: "var(--sc-mist)",
            padding: "3px 8px",
            fontSize: 11,
            fontFamily: "var(--sc-mono)",
          }}
        >
          127.0.0.1:{window.sandcastle.port || "..."}
        </span>
      }
      dock={
        <FleetDock
          runs={runs}
          capacity={fleet?.capacity ?? { used: 0, max: 1 }}
          currentRunId={runId}
          connectionState={mapConnectionState(connectionState)}
          onDeploy={() => setDeployOpen(true)}
          hrefForRun={(run) => `/runs/${run.id}/cockpit`}
          onSelectRun={(run, event) => {
            event.preventDefault();
            navigate(`/runs/${run.id}/cockpit`);
          }}
        />
      }
      chord={
        <DeployChordOverlay
          open={deployOpen}
          onOpenChange={setDeployOpen}
          onSubmit={handleDeploySubmit}
          pending={createRun.isPending}
          error={createRun.error?.message ?? null}
        />
      }
    >
      <Outlet />
    </AppChromeShell>
  );
}
