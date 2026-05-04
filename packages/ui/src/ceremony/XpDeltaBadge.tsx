import type { CSSProperties, JSX } from "react";
import styles from "./XpDeltaBadge.module.css";

export interface XpDeltaBadgeProps {
  /**
   * The XP delta. `null`/`undefined` means we don't know yet — the badge
   * renders an honest "—" placeholder. Negative values render with a
   * crimson tone.
   */
  readonly xpDelta: number | null | undefined;
  /** When true, the appear animation is suppressed (mirrors reduced-motion). */
  readonly reducedMotion?: boolean;
  readonly className?: string;
  /**
   * Visual size; "lg" is for the ceremony hero, "sm" for inline toasts and
   * activity feed entries.
   */
  readonly size?: "sm" | "md" | "lg";
}

/**
 * Animated +N XP chip. Static fallback under `prefers-reduced-motion` and
 * when `reducedMotion` is forced. Renders "— XP" honestly when xpDelta is
 * null/undefined.
 */
export function XpDeltaBadge({
  xpDelta,
  reducedMotion = false,
  className,
  size = "md",
}: XpDeltaBadgeProps): JSX.Element {
  const known = typeof xpDelta === "number" && Number.isFinite(xpDelta);
  const positive = known && (xpDelta as number) > 0;
  const negative = known && (xpDelta as number) < 0;

  const tone = positive
    ? styles["tone-positive"]
    : negative
      ? styles["tone-negative"]
      : styles["tone-neutral"];

  const sizeClass =
    size === "lg"
      ? styles["size-lg"]
      : size === "sm"
        ? styles["size-sm"]
        : styles["size-md"];

  const cls = [
    styles.root,
    tone,
    sizeClass,
    reducedMotion ? styles["no-animate"] : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const label = !known
    ? "— XP"
    : `${(xpDelta as number) > 0 ? "+" : ""}${(xpDelta as number).toLocaleString()} XP`;

  const ariaLabel = !known
    ? "XP delta unknown"
    : `${(xpDelta as number) > 0 ? "Gained" : "Lost"} ${Math.abs(xpDelta as number)} XP`;

  // Static fallback inline override (defensive — works regardless of CSS).
  const inlineStyle: CSSProperties = reducedMotion ? { animation: "none" } : {};

  return (
    <span
      className={cls}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      style={inlineStyle}
    >
      {label}
    </span>
  );
}
