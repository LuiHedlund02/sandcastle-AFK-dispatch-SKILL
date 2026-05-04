import type { JSX, ReactNode } from "react";
import { OctaPanel } from "../layout/OctaPanel.js";
import styles from "./CombatStage.module.css";

export interface CombatStageProps {
  /** Run id, displayed in the banner. */
  readonly runId: string;
  /** Operative codename / id; rendered as the boss-style banner name. */
  readonly operativeName: string;
  /** Planet / repo display label (subtitle under the operative). */
  readonly planetName: string;
  /** Current run status label, e.g. "casting", "verifying", "victory". */
  readonly statusLabel: string;
  /** Optional extra controls — e.g. a "Cockpit view" link from the consumer. */
  readonly bannerActions?: ReactNode;
  /** Phase round cards (`PhaseRound[]`). */
  readonly children?: ReactNode;
  /** Right-side dossier (`CombatHud`). */
  readonly hud?: ReactNode;
  /** Wraps everything in an `OctaPanel`. Defaults to true. */
  readonly framed?: boolean;
  readonly className?: string;
}

/**
 * Combat-skin layout. Two columns: the phase-round scroll on the left
 * (with a banner above it announcing the operative + planet + run status),
 * and a sticky `CombatHud` on the right.
 *
 * Pure presentational. No fetching, no animation state — it's a frame
 * around `PhaseRound` children + a hud slot. Consumers wire run / phase
 * data in. Reduced-motion is honored by the children, not the stage.
 */
export function CombatStage({
  runId,
  operativeName,
  planetName,
  statusLabel,
  bannerActions,
  children,
  hud,
  framed = true,
  className,
}: CombatStageProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");

  const stage = (
    <div className={cls}>
      <div className={styles["col-main"]}>
        <header className={styles.banner} aria-label="Combat banner">
          <div>
            <div className={styles["banner-meta"]}>
              <span>operative</span>
            </div>
            <div className={styles["banner-name"]}>{operativeName}</div>
            <div className={styles["banner-meta"]}>
              <span>{planetName}</span>
              <span>run {runId}</span>
            </div>
          </div>
          <div className={styles["banner-actions"]}>
            <span
              role="status"
              aria-label={`Combat status: ${statusLabel}`}
              style={{
                fontFamily: "var(--sc-display)",
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--sc-magenta)",
                padding: "4px 10px",
                border: "1px solid var(--sc-magenta-dim)",
                background: "var(--sc-magenta-ink)",
              }}
            >
              {statusLabel}
            </span>
            {bannerActions}
          </div>
        </header>

        <div className={styles.scroll}>
          {children ?? (
            <div className={styles.empty}>
              No phases yet — round zero awaits the first directive.
            </div>
          )}
        </div>
      </div>
      {hud ? <aside aria-label="Combat HUD">{hud}</aside> : null}
    </div>
  );

  if (!framed) return stage;

  return (
    <OctaPanel
      tone="magenta"
      eyebrow={
        <>
          <span aria-hidden="true">0xFF</span>
          <span>Combat</span>
        </>
      }
      bodyClassName={styles["panel-body"]}
    >
      {stage}
    </OctaPanel>
  );
}
