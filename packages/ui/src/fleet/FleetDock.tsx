import type { JSX, MouseEvent, ReactNode } from "react";
import { Play } from "lucide-react";
import type { Run } from "@sandcastle/protocol";
import { FleetDockCell } from "./FleetDockCell.js";
import { MergeAllGreenButton } from "./MergeAllGreenButton.js";
import styles from "./FleetDock.module.css";

export type FleetConnectionState = "open" | "connecting" | "closed";

export interface FleetDockProps {
  readonly runs: readonly Run[];
  readonly capacity: { readonly used: number; readonly max: number };
  readonly currentRunId?: string;
  readonly connectionState?: FleetConnectionState;
  readonly onDeploy: () => void;
  readonly onSelectRun?: (run: Run, event: MouseEvent) => void;
  readonly hrefForRun?: (run: Run) => string | undefined;
  readonly mergeAllGreenEnabled?: boolean;
  readonly onMergeAllGreen?: () => void;
  readonly mergeAllGreenPending?: boolean;
  readonly emptyHint?: ReactNode;
  readonly className?: string;
}

/**
 * 88px persistent bottom bar listing every active run.
 *
 * Pure props in / callbacks out. No data fetching, no router awareness.
 * The desktop app wires this up to its Zustand fleet store + react-router.
 */
export function FleetDock({
  runs,
  capacity,
  currentRunId,
  connectionState = "open",
  onDeploy,
  onSelectRun,
  hrefForRun,
  mergeAllGreenEnabled = false,
  onMergeAllGreen,
  mergeAllGreenPending,
  emptyHint,
  className,
}: FleetDockProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");
  return (
    <nav className={cls} aria-label="Fleet dock">
      <button className={styles.head} type="button" onClick={onDeploy}>
        <span>Fleet</span>
        <strong>
          {capacity.used} <em>/ {capacity.max}</em>
        </strong>
        <small>{connectionState}</small>
      </button>

      <div className={styles.cells} role="list">
        {runs.length === 0 ? (
          <div
            className={styles.empty}
            role="listitem"
            aria-label="No active deployments"
          >
            <span className={styles.avatar} aria-hidden="true">
              π
            </span>
            <span>{emptyHint ?? "No active deployments"}</span>
          </div>
        ) : (
          runs.map((run) => (
            <div role="listitem" key={run.id} style={{ display: "contents" }}>
              <FleetDockCell
                run={run}
                current={run.id === currentRunId}
                href={hrefForRun?.(run)}
                onActivate={onSelectRun}
              />
            </div>
          ))
        )}
      </div>

      <div className={styles.actions}>
        <MergeAllGreenButton
          enabled={mergeAllGreenEnabled}
          pending={mergeAllGreenPending}
          onClick={onMergeAllGreen}
        />
        <button
          className={`${styles.button} ${styles["button-deploy"]}`}
          type="button"
          onClick={onDeploy}
        >
          <Play size={14} fill="currentColor" aria-hidden="true" />
          Deploy <kbd>Ctrl D</kbd>
        </button>
      </div>
    </nav>
  );
}
