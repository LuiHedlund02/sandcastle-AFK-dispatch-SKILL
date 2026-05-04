import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import styles from "./DeployChordOverlay.module.css";

export interface DeployChordSubmission {
  readonly directive: string;
}

export interface DeployChordOverlayProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (submission: DeployChordSubmission) => void;
  /** When true, the submit button is shown in a busy state and the form is disabled. */
  readonly pending?: boolean;
  /** A non-fatal error string to surface above the footer (e.g. server rejection). */
  readonly error?: string | null;
  /** Optional left chip — defaults to "π · default". */
  readonly operativeChip?: ReactNode;
  /** Optional right chip — defaults to "local repo". */
  readonly targetChip?: ReactNode;
  readonly placeholder?: string;
  /** Initial directive text. Useful when re-opening with a previously typed directive. */
  readonly initialDirective?: string;
}

/**
 * The ⌘D / Ctrl+D deploy overlay.
 *
 * Owns its own directive draft state. The parent controls open/close via
 * `open` + `onOpenChange`. On submit, calls `onSubmit({ directive })` with
 * the trimmed directive. The parent decides what to do with it (create run,
 * navigate, etc.) — the primitive does not call any APIs.
 */
export function DeployChordOverlay({
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  error,
  operativeChip,
  targetChip,
  placeholder,
  initialDirective = "",
}: DeployChordOverlayProps): JSX.Element | null {
  const [directive, setDirective] = useState(initialDirective);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();

  // Reset draft when the overlay is dismissed externally.
  useEffect(() => {
    if (!open) setDirective(initialDirective);
  }, [open, initialDirective]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = directive.trim();
    if (!trimmed || pending) return;
    onSubmit({ directive: trimmed });
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onOpenChange(false);
      }}
      role="presentation"
    >
      <form
        className={styles.dialog}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <header className={styles.head}>
          <span id={headingId}>
            <Play size={16} fill="currentColor" aria-hidden="true" /> Deploy
            chord
          </span>
          <button
            type="button"
            className={styles.close}
            onClick={() => onOpenChange(false)}
            title="Close deploy chord"
            aria-label="Close deploy chord"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.route}>
          <span className={styles.verb}>Deploy</span>
          <span className={styles.chip}>{operativeChip ?? "π · default"}</span>
          <span>to</span>
          <span className={`${styles.chip} ${styles["chip-target"]}`}>
            {targetChip ?? "local repo"}
          </span>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Directive</span>
          <textarea
            ref={inputRef}
            value={directive}
            onChange={(event) => setDirective(event.target.value)}
            placeholder={
              placeholder ??
              "Fix one small issue and explain the verification path..."
            }
            rows={5}
            className={styles.textarea}
            disabled={pending}
            aria-label="Directive"
          />
        </label>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <footer className={styles.footer}>
          <span>
            <kbd>Esc</kbd> dismiss
          </span>
          <button
            type="submit"
            className={styles.submit}
            disabled={!directive.trim() || pending}
          >
            {pending ? "Deploying" : "Deploy"}
          </button>
        </footer>
      </form>
    </div>
  );
}
