import type { JSX } from "react";
import styles from "./FilmGrainOverlay.module.css";

export interface FilmGrainOverlayProps {
  readonly fixed?: boolean;
  readonly className?: string;
}

/**
 * Fixed-viewport film-grain noise layer.
 * Hidden under `prefers-contrast: more`; static under `prefers-reduced-motion`.
 */
export function FilmGrainOverlay({
  fixed = true,
  className,
}: FilmGrainOverlayProps): JSX.Element {
  const cls = [fixed ? styles.root : styles.absolute, className]
    .filter(Boolean)
    .join(" ");
  return <div aria-hidden="true" className={cls} />;
}
