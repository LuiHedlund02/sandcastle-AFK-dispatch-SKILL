import type { JSX } from "react";
import styles from "./CrtRasterOverlay.module.css";

export interface CrtRasterOverlayProps {
  /** When false, the overlay positions absolutely inside its container instead of fixed-viewport. */
  readonly fixed?: boolean;
  readonly className?: string;
}

/**
 * The faint scanline + chromatic-wash overlay used on every screen.
 * Respects `prefers-reduced-motion` (drops the flicker animation) and
 * disappears entirely under `prefers-contrast: more`.
 */
export function CrtRasterOverlay({
  fixed = true,
  className,
}: CrtRasterOverlayProps): JSX.Element {
  const cls = [fixed ? styles.root : styles.absolute, className]
    .filter(Boolean)
    .join(" ");
  return <div aria-hidden="true" className={cls} />;
}
