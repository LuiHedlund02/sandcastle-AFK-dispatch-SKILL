import type { JSX } from "react";
import type { SkillCard } from "@sandcastle/protocol";
import { CardFrame } from "./CardFrame.js";

export interface SkillCardViewProps {
  readonly card: SkillCard;
  readonly onSelect?: (card: SkillCard) => void;
  readonly showBody?: boolean;
  readonly className?: string;
}

/**
 * Skill card — a passive trigger that activates on hint match.
 */
export function SkillCardView({
  card,
  onSelect,
  showBody = false,
  className,
}: SkillCardViewProps): JSX.Element {
  return (
    <CardFrame
      type="skill"
      glyph="S"
      title={card.title}
      summary={card.summary}
      meta={card.enabled ? "ON" : "OFF"}
      onClick={onSelect ? () => onSelect(card) : undefined}
      className={className}
      aria-label={`Skill card ${card.title}`}
    >
      {showBody ? (
        <pre style={{ margin: 0, fontFamily: "inherit" }}>{card.body}</pre>
      ) : null}
      {card.triggerHints.length > 0 ? (
        <span>Triggers: {card.triggerHints.join(", ")}</span>
      ) : null}
    </CardFrame>
  );
}
