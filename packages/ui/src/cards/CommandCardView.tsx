import type { JSX } from "react";
import type { CommandCard } from "@sandcastle/protocol";
import { CardFrame } from "./CardFrame.js";

export interface CommandCardViewProps {
  readonly card: CommandCard;
  readonly onSelect?: (card: CommandCard) => void;
  readonly showBody?: boolean;
  readonly className?: string;
}

/**
 * Command card — invoked explicitly via slash command.
 */
export function CommandCardView({
  card,
  onSelect,
  showBody = false,
  className,
}: CommandCardViewProps): JSX.Element {
  return (
    <CardFrame
      type="command"
      glyph="/"
      title={card.title}
      summary={card.summary}
      meta={card.slashCommand}
      onClick={onSelect ? () => onSelect(card) : undefined}
      className={className}
      aria-label={`Command card ${card.title}`}
    >
      {showBody ? (
        <pre style={{ margin: 0, fontFamily: "inherit" }}>{card.body}</pre>
      ) : null}
      {card.verifyHints.length > 0 ? (
        <span>Verify: {card.verifyHints.join(", ")}</span>
      ) : null}
    </CardFrame>
  );
}
