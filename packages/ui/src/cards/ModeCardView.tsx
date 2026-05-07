import type { JSX } from "react";
import type { ModeCard } from "@sandcastle/protocol";
import { CardFrame } from "./CardFrame.js";

export interface ModeCardViewProps {
  readonly card: ModeCard;
  readonly onSelect?: (card: ModeCard) => void;
  /** When false, the card renders dimmed with the constraints hidden. */
  readonly active?: boolean;
  /** Render the markdown body. v1 uses `<pre>` (deferred markdown rendering). */
  readonly showBody?: boolean;
  readonly className?: string;
}

/**
 * The MODE slot — a single big card describing how the operative behaves.
 * v1: body is rendered as preformatted text (markdown rendering deferred).
 */
export function ModeCardView({
  card,
  onSelect,
  active = true,
  showBody = false,
  className,
}: ModeCardViewProps): JSX.Element {
  return (
    <CardFrame
      type="mode"
      glyph="⌘"
      title={card.title}
      summary={card.summary}
      meta={active ? "ACTIVE" : "PAUSED"}
      onClick={onSelect ? () => onSelect(card) : undefined}
      disabled={!active}
      className={className}
      aria-label={`Mode card ${card.title}`}
    >
      {showBody ? (
        <pre style={{ margin: 0, fontFamily: "inherit" }}>{card.body}</pre>
      ) : null}
      {card.constraints.length > 0 ? (
        <span>Constraints: {card.constraints.join(" · ")}</span>
      ) : null}
    </CardFrame>
  );
}
