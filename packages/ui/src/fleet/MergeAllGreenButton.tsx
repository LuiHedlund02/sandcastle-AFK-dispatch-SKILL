import type { JSX } from "react";
import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import styles from "./FleetDock.module.css";

export interface MergeAllGreenResult {
  /** Number of runs that merged successfully. */
  readonly ok: number;
  /** Number of runs that failed to merge. */
  readonly failed: number;
  /** True when the server aborted the batch (e.g. budget). */
  readonly aborted: boolean;
}

export interface MergeAllGreenButtonProps {
  /** When true, the button is enabled. Otherwise it shows a muted hint. */
  readonly enabled: boolean;
  readonly pending?: boolean;
  readonly onClick?: () => void | Promise<void>;
  /**
   * Most-recent batch result, if any. When provided the button briefly
   * flashes a count summary in its label before reverting.
   */
  readonly result?: MergeAllGreenResult | null;
  readonly className?: string;
}

const FLASH_DURATION_MS = 4000;

/**
 * Gated "Merge all green" action. Only enabled when the caller has
 * verified that all pending runs passed verification — the primitive
 * does not look at fleet state itself.
 *
 * After a click, when the parent passes back a `result`, the button label
 * flashes a brief summary ("3 ok · 1 failed") for a few seconds, then
 * reverts to the default label.
 */
export function MergeAllGreenButton({
  enabled,
  pending,
  onClick,
  result,
  className,
}: MergeAllGreenButtonProps): JSX.Element {
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!result) {
      setFlashing(false);
      return;
    }
    setFlashing(true);
    const timer = window.setTimeout(
      () => setFlashing(false),
      FLASH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [result]);

  const cls = [
    styles.button,
    styles["button-merge"],
    flashing && result && result.failed === 0 && !result.aborted
      ? styles["button-merge-flash-ok"]
      : null,
    flashing && result && (result.failed > 0 || result.aborted)
      ? styles["button-merge-flash-mixed"]
      : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const disabled = !enabled || pending;

  const handleClick = (): void => {
    if (disabled) return;
    const result = onClick?.();
    if (result && typeof (result as Promise<void>).then === "function") {
      void result;
    }
  };

  const label = ((): string => {
    if (pending) return "Merging";
    if (flashing && result) {
      const parts: string[] = [];
      if (result.ok > 0) parts.push(`${result.ok} ok`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      if (result.aborted) parts.push("aborted");
      return parts.length === 0 ? "no runs" : parts.join(" · ");
    }
    return "Merge all green";
  })();

  return (
    <button
      type="button"
      className={cls}
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-live={flashing ? "polite" : undefined}
      title={
        enabled
          ? "Merge every win-pending run"
          : "Gated until all pending runs are green"
      }
      data-flashing={flashing ? "true" : undefined}
    >
      <CheckCheck size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
