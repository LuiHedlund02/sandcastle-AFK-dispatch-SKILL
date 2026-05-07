import type { JSX, ReactNode } from "react";
import styles from "./AppChrome.module.css";

export interface AppChromeProps {
  /** Main content area. */
  readonly children: ReactNode;
  /** The persistent fleet dock — typically a `<FleetDock />`. */
  readonly dock?: ReactNode;
  /** The deploy overlay slot — typically a `<DeployChordOverlay />`. */
  readonly chord?: ReactNode;
  /** Title-bar centre element. Defaults to "local control link". */
  readonly center?: ReactNode;
  /** Title-bar left, after the brand mark. Defaults to "Sandcastle / Cockpit". */
  readonly contextLabel?: ReactNode;
  /** Title-bar right (controls, port chip, etc.). */
  readonly right?: ReactNode;
}

/**
 * Pure shell. Provides:
 *   - the cyberpunk titlebar with traffic lights + brand
 *   - a scrollable `<main>` for the route outlet
 *   - a slot for the persistent FleetDock
 *   - a slot for the DeployChordOverlay
 *
 * Has no awareness of routing, sockets, or stores. The desktop app
 * composes those around it.
 */
export function AppChrome({
  children,
  dock,
  chord,
  center = "local control link",
  contextLabel = (
    <>
      <span className={styles.brandWord}>Sandcastle</span>
      <span className={styles.brandContext}>Cockpit</span>
    </>
  ),
  right,
}: AppChromeProps): JSX.Element {
  return (
    <div className={styles.shell}>
      <header className={styles.titlebar}>
        <div className={styles.left}>
          <span className={styles.traffic} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={styles.brandMark} aria-hidden="true">
            S
          </span>
          {contextLabel}
        </div>
        <div className={styles.center}>{center}</div>
        <div className={styles.right}>{right}</div>
      </header>
      <main className={styles.main}>{children}</main>
      {dock}
      {chord}
    </div>
  );
}
