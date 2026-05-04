import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Play, X } from "lucide-react";
import {
  parseDeployChord,
  type ParsedDeploy,
  type PlanetForParser,
} from "./parseDeployChord.js";
import styles from "./DeployChordOverlay.module.css";

export interface DeployChordSubmission {
  readonly directive: string;
}

export interface DeployChordMultiSubmission {
  /** Operative explicitly typed by the user, or `undefined` to use current focus. */
  readonly operativeId?: string;
  /**
   * Resolved planet ids the directive should fan out to. Empty means "current
   * planet" — the parent substitutes its default. Always at least one
   * effective target by the time onMultiSubmit fires (submit is gated when
   * the user typed `deploy to ...` but no target resolved).
   */
  readonly targets: readonly { id: string; repoName: string }[];
  readonly directive: string;
}

export interface DeployChordOverlayProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Single-target submit handler (Phase 0/1 contract). Always called when
   * `onMultiSubmit` is not provided and the user submits a non-empty
   * directive. Receives the trimmed directive — the parent decides which
   * planet/operative to use.
   */
  readonly onSubmit?: (submission: DeployChordSubmission) => void;
  /**
   * Multi-target submit handler (Phase 2 contract). When provided, this is
   * always called instead of `onSubmit`, with the parsed shape. The parent
   * is responsible for fanning out N `createRun` calls.
   */
  readonly onMultiSubmit?: (submission: DeployChordMultiSubmission) => void;
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
  /**
   * Known planets the renderer can target. When provided, the overlay shows
   * a live parser preview and routes through `onMultiSubmit`. When omitted,
   * the overlay falls back to the original single-target flow.
   */
  readonly planets?: readonly PlanetForParser[];
  /**
   * The current planet, used to label the fallback chip when the user did
   * not type an explicit `deploy to ...` form.
   */
  readonly currentPlanet?: PlanetForParser;
}

/**
 * The ⌘D / Ctrl+D deploy overlay.
 *
 * Owns its own directive draft state. The parent controls open/close via
 * `open` + `onOpenChange`. On submit, calls `onSubmit({ directive })` (or
 * `onMultiSubmit({ ... })` when `onMultiSubmit` is provided) with the
 * trimmed directive. The parent decides what to do with it (create run,
 * navigate, etc.) — the primitive does not call any APIs.
 */
export function DeployChordOverlay({
  open,
  onOpenChange,
  onSubmit,
  onMultiSubmit,
  pending = false,
  error,
  operativeChip,
  targetChip,
  placeholder,
  initialDirective = "",
  planets,
  currentPlanet,
}: DeployChordOverlayProps): JSX.Element | null {
  const [draft, setDraft] = useState(initialDirective);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();

  // Reset draft when the overlay is dismissed externally.
  useEffect(() => {
    if (!open) setDraft(initialDirective);
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

  const parsed: ParsedDeploy | null = useMemo(() => {
    if (planets === undefined) return null;
    return parseDeployChord(draft, planets);
  }, [draft, planets]);

  if (!open) return null;

  // Effective directive used for both submit gating and the directive sent.
  const effectiveDirective = parsed
    ? parsed.directive.length > 0
      ? parsed.directive
      : parsed.multiTargetForm
        ? ""
        : draft.trim()
    : draft.trim();

  // Effective targets:
  //  - If user used multi-target form and resolved >=1 target → those.
  //  - If user used multi-target form but resolved zero (only unknowns) → empty (gated).
  //  - Otherwise → fall back to current planet (or empty if unknown).
  const effectiveTargets: readonly { id: string; repoName: string }[] = parsed
    ? parsed.targets.length > 0
      ? parsed.targets.map((t) => ({ id: t.id, repoName: t.repoName }))
      : parsed.multiTargetForm
        ? []
        : currentPlanet
          ? [{ id: currentPlanet.id, repoName: currentPlanet.repoName }]
          : []
    : [];

  const submitDisabled =
    !effectiveDirective ||
    pending ||
    (parsed != null &&
      onMultiSubmit !== undefined &&
      effectiveTargets.length === 0);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (submitDisabled) return;
    if (onMultiSubmit && parsed) {
      onMultiSubmit({
        operativeId: parsed.operativeId,
        targets: effectiveTargets,
        directive: effectiveDirective,
      });
      return;
    }
    if (onSubmit) {
      onSubmit({ directive: effectiveDirective });
    }
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
          <span className={styles.chip}>
            {parsed?.operativeId
              ? `op · ${parsed.operativeId}`
              : (operativeChip ?? "π · default")}
          </span>
          <span>to</span>
          {parsed && parsed.multiTargetForm ? (
            <DeployTargetChips parsed={parsed} />
          ) : (
            <span className={`${styles.chip} ${styles["chip-target"]}`}>
              {currentPlanet
                ? `current · ${currentPlanet.repoName}`
                : (targetChip ?? "local repo")}
            </span>
          )}
        </div>

        {parsed ? (
          <DeployParserPreview
            parsed={parsed}
            currentPlanet={currentPlanet}
            multiSubmitProvided={onMultiSubmit !== undefined}
          />
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Directive</span>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              placeholder ??
              (planets
                ? "deploy to alpha, beta :: refactor the auth flow..."
                : "Fix one small issue and explain the verification path...")
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
            disabled={submitDisabled}
          >
            {pending
              ? "Deploying"
              : effectiveTargets.length > 1
                ? `Deploy × ${effectiveTargets.length}`
                : "Deploy"}
          </button>
        </footer>
      </form>
    </div>
  );
}

interface DeployTargetChipsProps {
  readonly parsed: ParsedDeploy;
}

function DeployTargetChips({ parsed }: DeployTargetChipsProps): JSX.Element {
  if (parsed.targets.length === 0 && parsed.unknownTargets.length === 0) {
    return (
      <span className={`${styles.chip} ${styles["chip-target"]}`}>
        no target
      </span>
    );
  }
  return (
    <span className={styles.chipGroup}>
      {parsed.targets.map((target) => (
        <span
          key={target.id}
          className={`${styles.chip} ${styles["chip-target"]}`}
          title={`Resolved planet: ${target.repoName}`}
        >
          {target.repoName}
        </span>
      ))}
      {parsed.unknownTargets.map((unknown, idx) => (
        <span
          key={`unknown-${idx}-${unknown}`}
          className={`${styles.chip} ${styles["chip-unknown"]}`}
          title={`Unknown target: ${unknown}`}
        >
          <AlertTriangle
            size={11}
            aria-hidden="true"
            style={{ marginRight: 4 }}
          />
          {unknown}
        </span>
      ))}
    </span>
  );
}

interface DeployParserPreviewProps {
  readonly parsed: ParsedDeploy;
  readonly currentPlanet: PlanetForParser | undefined;
  readonly multiSubmitProvided: boolean;
}

function DeployParserPreview({
  parsed,
  currentPlanet,
  multiSubmitProvided,
}: DeployParserPreviewProps): JSX.Element {
  const targetCount = parsed.multiTargetForm
    ? parsed.targets.length
    : currentPlanet
      ? 1
      : 0;

  return (
    <div
      className={styles.preview}
      aria-live="polite"
      data-testid="parser-preview"
    >
      <dl className={styles.previewGrid}>
        <dt>Operative</dt>
        <dd>
          {parsed.operativeId ?? (
            <span className={styles.previewMuted}>current focus</span>
          )}
        </dd>
        <dt>Targets</dt>
        <dd>
          {targetCount === 0 ? (
            <span className={styles.previewMuted}>
              {parsed.multiTargetForm ? "no resolved planet" : "current planet"}
            </span>
          ) : parsed.multiTargetForm ? (
            <span>
              {targetCount} planet{targetCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span>{currentPlanet?.repoName ?? "current planet"}</span>
          )}
        </dd>
        <dt>Directive</dt>
        <dd>
          {parsed.directive.length > 0 ? (
            <code className={styles.previewCode}>{parsed.directive}</code>
          ) : (
            <span className={styles.previewMuted}>
              {parsed.multiTargetForm ? "missing — type :: <directive>" : "—"}
            </span>
          )}
        </dd>
      </dl>
      {parsed.unknownTargets.length > 0 ? (
        <p
          className={styles.previewWarn}
          role="alert"
          data-testid="parser-warning"
        >
          <AlertTriangle size={12} aria-hidden="true" /> Unknown target
          {parsed.unknownTargets.length === 1 ? "" : "s"}:{" "}
          {parsed.unknownTargets.join(", ")}
        </p>
      ) : null}
      {!multiSubmitProvided ? null : parsed.multiTargetForm &&
        parsed.targets.length === 0 &&
        parsed.unknownTargets.length === 0 ? (
        <p className={styles.previewWarn} role="alert">
          <AlertTriangle size={12} aria-hidden="true" /> Type at least one
          target after <code>to</code>.
        </p>
      ) : null}
    </div>
  );
}
