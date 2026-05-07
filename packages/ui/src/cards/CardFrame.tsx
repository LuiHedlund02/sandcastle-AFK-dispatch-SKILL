import type { JSX, ReactNode } from "react";
import type { CardType } from "@sandcastle/protocol";
import styles from "./CardFrame.module.css";

export interface CardFrameProps {
  readonly type: CardType;
  readonly glyph?: ReactNode;
  readonly title: ReactNode;
  readonly summary?: ReactNode;
  readonly meta?: ReactNode;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
  /** Optional accessible label override; defaults to title text. */
  readonly "aria-label"?: string;
}

const toneByType: Record<CardType, string> = {
  mode: styles["tone-mode"]!,
  skill: styles["tone-skill"]!,
  command: styles["tone-command"]!,
};

const glyphByType: Record<CardType, string> = {
  mode: "M",
  skill: "S",
  command: "/",
};

/**
 * The shared holographic card frame. The 3 typed views (`ModeCardView`,
 * `SkillCardView`, `CommandCardView`) wrap this with their fields.
 */
export function CardFrame({
  type,
  glyph,
  title,
  summary,
  meta,
  children,
  disabled,
  onClick,
  className,
  "aria-label": ariaLabel,
}: CardFrameProps): JSX.Element {
  const cls = [
    styles.root,
    toneByType[type],
    disabled ? styles.disabled : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <span className={styles.glyph} aria-hidden="true">
        {glyph ?? glyphByType[type]}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {summary != null ? (
          <span className={styles.summary}>{summary}</span>
        ) : null}
        {children != null ? (
          <span className={styles["body-extra"]}>{children}</span>
        ) : null}
      </span>
      {meta != null ? <span className={styles.meta}>{meta}</span> : null}
    </button>
  );
}
