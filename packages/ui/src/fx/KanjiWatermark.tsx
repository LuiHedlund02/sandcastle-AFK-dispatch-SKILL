import type { JSX } from "react";
import styles from "./KanjiWatermark.module.css";

export interface KanjiWatermarkProps {
  /**
   * The katakana/kanji string rendered along the right edge.
   * Defaults to the cockpit mockup's status string. Pages can pass a
   * route-specific variant (e.g. "サンドキャッスル ／ FLEET ／ ３ 同時並行 ／ 接続済").
   */
  readonly text?: string;
  readonly className?: string;
}

const DEFAULT_TEXT =
  "サンドキャッスル ／ システム稼働中 ／ AGENT-π ／ T+12:04 ／ 接続済";

/**
 * Fixed katakana watermark anchored at the right edge of the viewport,
 * rotated -90deg, magenta with low opacity. Mirrors the mockup
 * `.app::after` rule from docs/mockups/cockpit.html (line 128) and
 * `.watermark` from docs/mockups/index.html (line 104). Pointer-events
 * are disabled so it never blocks interaction.
 */
export function KanjiWatermark({
  text = DEFAULT_TEXT,
  className,
}: KanjiWatermarkProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");
  return (
    <span aria-hidden="true" className={cls}>
      {text}
    </span>
  );
}
