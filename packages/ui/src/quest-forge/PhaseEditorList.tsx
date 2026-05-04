import type { JSX, ReactNode } from "react";
import type { ParsedPhase } from "@sandcastle/protocol";
import { PhaseEditorCard } from "./PhaseEditorCard.js";
import styles from "./PhaseEditorList.module.css";

export interface PhaseEditorListProps {
  readonly phases: readonly ParsedPhase[];
  readonly onChange: (next: readonly ParsedPhase[]) => void;
  readonly emptyHint?: ReactNode;
  readonly className?: string;
}

/**
 * Vertical list of editable phase cards. Supports per-card edits, reorder
 * (up / down), and delete. Pure controlled — every mutation produces a new
 * array via `onChange`.
 *
 * Ordinals are kept in sync with array order: when phases are reordered or
 * deleted the list emits ordinals 1..N in the new positions.
 */
export function PhaseEditorList({
  phases,
  onChange,
  emptyHint,
  className,
}: PhaseEditorListProps): JSX.Element {
  const cls = [styles.root, className].filter(Boolean).join(" ");

  if (phases.length === 0) {
    return (
      <div className={cls}>
        <div className={styles.empty}>
          {emptyHint ?? "No phases yet — type a directive to forge them."}
        </div>
      </div>
    );
  }

  const renumber = (arr: readonly ParsedPhase[]): readonly ParsedPhase[] =>
    arr.map((p, i) => ({ ...p, ordinal: i + 1 }));

  const updateAt = (idx: number, next: ParsedPhase) => {
    onChange(
      renumber(phases.map((p, i) => (i === idx ? { ...next, id: p.id } : p))),
    );
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = phases.slice();
    const tmp = next[idx]!;
    next[idx] = next[idx - 1]!;
    next[idx - 1] = tmp;
    onChange(renumber(next));
  };

  const moveDown = (idx: number) => {
    if (idx === phases.length - 1) return;
    const next = phases.slice();
    const tmp = next[idx]!;
    next[idx] = next[idx + 1]!;
    next[idx + 1] = tmp;
    onChange(renumber(next));
  };

  const deleteAt = (idx: number) => {
    onChange(renumber(phases.filter((_, i) => i !== idx)));
  };

  return (
    <div className={cls}>
      {phases.map((phase, i) => (
        <PhaseEditorCard
          key={phase.id}
          phase={phase}
          canMoveUp={i > 0}
          canMoveDown={i < phases.length - 1}
          onChange={(next) => updateAt(i, next)}
          onMoveUp={() => moveUp(i)}
          onMoveDown={() => moveDown(i)}
          onDelete={() => deleteAt(i)}
        />
      ))}
    </div>
  );
}
