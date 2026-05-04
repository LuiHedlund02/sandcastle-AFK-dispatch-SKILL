import type { JSX, MouseEvent, ReactNode } from "react";
import { Play } from "lucide-react";
import type { Run, RunDecisionKind } from "@sandcastle/protocol";
import { FleetDockCell } from "./FleetDockCell.js";
import {
  MergeAllGreenButton,
  type MergeAllGreenResult,
} from "./MergeAllGreenButton.js";
import { WinPendingDecisionCard } from "./WinPendingDecisionCard.js";
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
  readonly onMergeAllGreen?: () => void | Promise<void>;
  readonly mergeAllGreenPending?: boolean;
  /** Most-recent batch result for the merge-all-green action (flashes briefly). */
  readonly mergeAllGreenResult?: MergeAllGreenResult | null;
  /**
   * Decision callback for win-pending / fail-pending runs. When omitted,
   * decision cards are not rendered.
   */
  readonly onDecide?: (runId: string, kind: RunDecisionKind) => void;
  /**
   * Run ids currently mid-decision (their decision cards disable buttons).
   */
  readonly decisionPendingRunIds?: readonly string[];
  readonly emptyHint?: ReactNode;
  readonly className?: string;
}

const isPendingDecision = (run: Run): boolean =>
  run.status === "win-pending" || run.status === "fail-pending";

/**
 * 88px persistent bottom bar listing every active run.
 *
 * Pure props in / callbacks out. No data fetching, no router awareness.
 * The desktop app wires this up to its Zustand fleet store + react-router.
 *
 * When a cell's run reaches `win-pending` or `fail-pending`, a small
 * decision card appears stacked above that cell with merge / revise /
 * discard actions. The dock surfaces these via the `onDecide` callback —
 * the parent wires it to the `decideRun` mutation.
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
  mergeAllGreenResult,
  onDecide,
  decisionPendingRunIds,
  emptyHint,
  className,
}: FleetDockProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");
  const decisionPendingSet = new Set(decisionPendingRunIds ?? []);
  const decisionRuns = onDecide
    ? runs.filter((run) => isPendingDecision(run))
    : [];

  return (
    <>
      {decisionRuns.length > 0 ? (
        <div className={styles.decisionStack} aria-label="Pending decisions">
          {decisionRuns.map((run) => (
            <WinPendingDecisionCard
              key={run.id}
              run={run}
              onDecide={(kind) => onDecide?.(run.id, kind)}
              pending={decisionPendingSet.has(run.id)}
            />
          ))}
        </div>
      ) : null}

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
            result={mergeAllGreenResult ?? null}
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
    </>
  );
}
