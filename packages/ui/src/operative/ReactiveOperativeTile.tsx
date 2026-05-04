import type { JSX, ReactNode } from "react";
import type {
  OperativeIdentity,
  OperativeMicroState,
} from "@sandcastle/protocol";
import { OperativePortrait } from "./OperativePortrait.js";
import type { OperativePortraitTone } from "./OperativePortrait.js";
import styles from "./ReactiveOperativeTile.module.css";

export interface ReactiveOperativeTileProps {
  readonly operative: OperativeIdentity;
  /** What the operative is doing right now. Drives the aura pulse + tone. */
  readonly microState?: OperativeMicroState;
  readonly onSelect?: (operative: OperativeIdentity) => void;
  readonly footer?: ReactNode;
  readonly className?: string;
  /** Custom glyph override; defaults to the first letter of the codename. */
  readonly glyph?: ReactNode;
}

const toneFromMicro: Record<OperativeMicroState, OperativePortraitTone> = {
  idle: "cyan",
  casting: "cyan",
  striking: "magenta",
  crit: "plasma",
  hit: "crimson",
};

/**
 * A single roster tile: portrait + name + chassis + level. The portrait
 * pulses while the operative is casting/striking; the tone shifts on
 * crit / hit. Pulse animation respects reduced-motion.
 */
export function ReactiveOperativeTile({
  operative,
  microState = "idle",
  onSelect,
  footer,
  className,
  glyph,
}: ReactiveOperativeTileProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");
  const tone = toneFromMicro[microState];
  const pulsing = microState !== "idle";
  const initial = operative.codename?.charAt(0).toUpperCase() || "π";
  return (
    <button
      type="button"
      className={cls}
      onClick={() => onSelect?.(operative)}
      aria-label={`Operative ${operative.codename}, level ${operative.level}, ${microState}`}
    >
      <OperativePortrait
        glyph={glyph ?? initial}
        tone={tone}
        size="md"
        pulsing={pulsing}
      />
      <div className={styles.body}>
        <span className={styles.name}>{operative.codename}</span>
        <span className={styles.chassis}>
          {operative.className} · {operative.model}
        </span>
        <div className={styles.statusRow}>
          <span className={styles.chassis}>{microState}</span>
          <span className={styles.level}>
            {String(operative.level).padStart(2, "0")}
            <small>LVL</small>
          </span>
        </div>
        {footer}
      </div>
    </button>
  );
}
