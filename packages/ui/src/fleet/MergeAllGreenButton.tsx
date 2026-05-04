import type { JSX } from "react";
import { CheckCheck } from "lucide-react";
import styles from "./FleetDock.module.css";

export interface MergeAllGreenButtonProps {
  /** When true, the button is enabled. Otherwise it shows a muted hint. */
  readonly enabled: boolean;
  readonly pending?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
}

/**
 * Gated "Merge all green" action. Only enabled when the caller has
 * verified that all pending runs passed verification — the primitive
 * does not look at fleet state itself.
 */
export function MergeAllGreenButton({
  enabled,
  pending,
  onClick,
  className,
}: MergeAllGreenButtonProps): JSX.Element {
  const cls = [styles.button, styles["button-merge"], className]
    .filter(Boolean)
    .join(" ");
  const disabled = !enabled || pending;
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={
        enabled
          ? "Merge every win-pending run"
          : "Gated until all pending runs are green"
      }
    >
      <CheckCheck size={14} aria-hidden="true" />
      {pending ? "Merging" : "Merge all green"}
    </button>
  );
}
