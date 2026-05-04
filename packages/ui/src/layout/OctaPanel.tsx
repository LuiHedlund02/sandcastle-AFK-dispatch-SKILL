import type { ElementType, JSX, ReactNode } from "react";
import styles from "./OctaPanel.module.css";

export type OctaPanelTone =
  | "default"
  | "cyan"
  | "magenta"
  | "plasma"
  | "amber"
  | "crimson";

export type OctaPanelSize = "sm" | "md";

export interface OctaPanelProps {
  readonly children?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly tone?: OctaPanelTone;
  readonly size?: OctaPanelSize;
  readonly as?: ElementType;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly id?: string;
  readonly role?: string;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
}

const toneClass: Record<OctaPanelTone, string | undefined> = {
  default: undefined,
  cyan: styles["tone-cyan"],
  magenta: styles["tone-magenta"],
  plasma: styles["tone-plasma"],
  amber: styles["tone-amber"],
  crimson: styles["tone-crimson"],
};

/**
 * The octagonal frame used by every interior surface in the cockpit.
 * Slots: optional `eyebrow`, `header`, body (`children`), and `footer`.
 *
 * The clip-path corners come from `--sc-clip-md` / `--sc-clip-sm` and so
 * inherit any high-contrast adjustments from tokens.css.
 */
export function OctaPanel({
  children,
  eyebrow,
  header,
  footer,
  tone = "default",
  size = "md",
  as,
  className,
  bodyClassName,
  ...rest
}: OctaPanelProps): JSX.Element {
  const Tag: ElementType = as ?? "section";
  const cls = [
    styles.root,
    size === "sm" ? styles["size-sm"] : styles["size-md"],
    toneClass[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyCls = [styles.body, bodyClassName].filter(Boolean).join(" ");

  return (
    <Tag className={cls} {...rest}>
      {eyebrow != null ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
      {header != null ? <div className={styles.header}>{header}</div> : null}
      {children != null ? <div className={bodyCls}>{children}</div> : null}
      {footer != null ? <div className={styles.footer}>{footer}</div> : null}
    </Tag>
  );
}
