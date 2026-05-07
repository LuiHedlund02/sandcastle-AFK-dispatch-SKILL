import type { CSSProperties, JSX } from "react";
import styles from "./ConfettiSpray.module.css";

export interface ConfettiSprayProps {
  /** Number of confetti pieces (default 12). */
  readonly count?: number;
  /** Override piece colors; cycles through. */
  readonly colors?: readonly string[];
  readonly className?: string;
  /**
   * For tests: when true, force-disable the burst animation (otherwise we
   * rely on `prefers-reduced-motion`). Pieces still render as static dots.
   */
  readonly reducedMotion?: boolean;
  readonly "aria-hidden"?: boolean;
}

const DEFAULT_COLORS = [
  "var(--sc-plasma, #6cffaa)",
  "var(--sc-cyan, #56d4e0)",
  "var(--sc-magenta, #ff2e88)",
  "var(--sc-amber, #ffb547)",
];

/**
 * Pure-CSS confetti burst. Twelve pieces by default radiate from the
 * geometric centre and fall slightly. Static under `prefers-reduced-motion`
 * and when `reducedMotion` is forced.
 *
 * The container is `pointer-events:none` and absolutely positioned by its
 * consumer (typically over the VictoryStage hero region).
 */
export function ConfettiSpray({
  count = 12,
  colors = DEFAULT_COLORS,
  className,
  reducedMotion = false,
  "aria-hidden": ariaHidden = true,
}: ConfettiSprayProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");

  const pieces = Array.from({ length: count }, (_, i) => {
    // distribute around an oval — width-biased so they spread sideways more
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const radius = 110 + ((i * 13) % 70);
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius * 0.85 + 8 * (i % 3);
    const rot = (i % 2 === 0 ? 1 : -1) * (180 + ((i * 47) % 360));
    const color = colors[i % colors.length] ?? DEFAULT_COLORS[0];
    const delay = (i * 35) % 220;

    const baseStyle: Record<string, string | number> = {
      background: color ?? DEFAULT_COLORS[0]!,
      "--tx": `${tx.toFixed(1)}px`,
      "--ty": `${ty.toFixed(1)}px`,
      "--rot": `${rot}deg`,
      animationDelay: reducedMotion ? "0ms" : `${delay}ms`,
    };
    if (reducedMotion) {
      baseStyle["animation"] = "none";
      baseStyle["opacity"] = 0.65;
      baseStyle["transform"] =
        `translate(calc(${(tx * 0.35).toFixed(1)}px - 50%), calc(${(ty * 0.35).toFixed(1)}px - 50%))`;
    }
    const style = baseStyle as CSSProperties;

    return (
      <span key={i} className={styles.piece} style={style} aria-hidden="true" />
    );
  });

  return (
    <div className={cls} aria-hidden={ariaHidden ?? true}>
      {pieces}
    </div>
  );
}
