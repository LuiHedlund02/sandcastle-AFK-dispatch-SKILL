import type { ElementType, JSX, ReactNode } from "react";
import styles from "./ChromaticHeadline.module.css";

export interface ChromaticHeadlineProps {
  readonly children: ReactNode;
  /** Element to render — defaults to `h1`. */
  readonly as?: ElementType;
  /** When true, oscillates the chroma offsets. Disabled under reduced-motion automatically. */
  readonly glitch?: boolean;
  readonly className?: string;
}

/**
 * Cyan/magenta-offset display heading. The offsets collapse to a flat
 * underline under `prefers-contrast: more`, and animation is suppressed
 * under `prefers-reduced-motion`.
 */
export function ChromaticHeadline({
  children,
  as,
  glitch = false,
  className,
}: ChromaticHeadlineProps): JSX.Element {
  const Tag: ElementType = as ?? "h1";
  const cls = [styles.root, glitch ? styles.glitch : null, className]
    .filter(Boolean)
    .join(" ");
  return <Tag className={cls}>{children}</Tag>;
}
