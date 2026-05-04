import type { JSX, ReactNode } from "react";
import styles from "./OperativePortrait.module.css";

export type OperativePortraitTone =
  | "cyan"
  | "magenta"
  | "plasma"
  | "amber"
  | "crimson";

export type OperativePortraitSize = "sm" | "md" | "lg";

export interface OperativePortraitProps {
  /** Glyph or short string. Defaults to "π" (the player operative). */
  readonly glyph?: ReactNode;
  readonly tone?: OperativePortraitTone;
  readonly size?: OperativePortraitSize;
  /** When true, an aura ring pulses around the portrait (suppressed under reduced-motion). */
  readonly pulsing?: boolean;
  readonly className?: string;
  readonly title?: string;
  /** Optional override for the visually-hidden accessible name. */
  readonly "aria-label"?: string;
}

const toneClasses: Record<OperativePortraitTone, string> = {
  cyan: "",
  magenta: styles["tone-magenta"]!,
  plasma: styles["tone-plasma"]!,
  amber: styles["tone-amber"]!,
  crimson: styles["tone-crimson"]!,
};

const sizeClasses: Record<OperativePortraitSize, string> = {
  sm: styles["size-sm"]!,
  md: styles["size-md"]!,
  lg: styles["size-lg"]!,
};

/**
 * The operative avatar — a glyph (e.g. "π") inside an octagon-cut frame
 * with the cyberpunk holographic shadow stack.
 */
export function OperativePortrait({
  glyph,
  tone = "cyan",
  size = "md",
  pulsing = false,
  className,
  title,
  "aria-label": ariaLabel,
}: OperativePortraitProps): JSX.Element {
  const cls = [styles.root, sizeClasses[size], toneClasses[tone], className]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={cls}
      title={title}
      role="img"
      aria-label={ariaLabel ?? title ?? "Operative portrait"}
    >
      {pulsing ? <span className={styles.aura} aria-hidden="true" /> : null}
      <span aria-hidden="true">{glyph ?? "π"}</span>
    </span>
  );
}
