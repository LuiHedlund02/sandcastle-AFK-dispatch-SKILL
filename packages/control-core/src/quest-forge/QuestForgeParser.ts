import type { ParsedPhase, VerifyRule } from "@sandcastle/protocol";

const IMPERATIVE_VERBS = [
  "Add",
  "Fix",
  "Refactor",
  "Test",
  "Document",
  "Reproduce",
  "Diagnose",
  "Patch",
  "Commit",
  "Implement",
  "Remove",
  "Update",
  "Verify",
  "Build",
  "Migrate",
  "Replace",
  "Introduce",
  "Extract",
  "Rename",
  "Reorganize",
  "Move",
  "Delete",
] as const;

const VERB_SOURCE = IMPERATIVE_VERBS.join("|");
const NUMBERED_MARKER_SOURCE = String.raw`(?:\d+[.)]\s+|step\s+\d+\s*:\s*)`;
const NUMBERED_MARKER_RE = new RegExp(`^\\s*${NUMBERED_MARKER_SOURCE}`, "i");
const VERB_START_RE = new RegExp(
  `^\\s*(?:${NUMBERED_MARKER_SOURCE})?(?:${VERB_SOURCE})\\b`,
  "i",
);
const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+(?=[A-Z])/g;

export class QuestForgeParser {
  parse(directive: string): ParsedPhase[] {
    const normalized = directive.replace(/\r\n?/g, "\n").trim();
    if (normalized.length === 0) return [];

    const segments = normalized
      .split(/\n{2,}/)
      .flatMap((block) => this.splitBlock(block))
      .map((segment) => segment.trim())
      .filter(Boolean);

    return segments.map((directiveSlice, index) => {
      const clean = stripNumberedMarker(directiveSlice).trim();
      const title = truncate(clean.replace(/\s+/g, " "), 60);
      return {
        id: `phase-${index + 1}`,
        ordinal: index + 1,
        title: title.length > 0 ? title : `Phase ${index + 1}`,
        directiveSlice,
        objective: synthesizeObjective(clean || directiveSlice),
        xpEstimate: estimateXp(directiveSlice),
        verifyRules: extractVerifyRules(directiveSlice),
      };
    });
  }

  private splitBlock(block: string): string[] {
    const segments: string[] = [];
    let buffer = "";

    const flush = (): void => {
      const next = buffer.trim();
      // Drop segments that are only a numbered marker (e.g. "3.") with
      // no actual content — they're orphaned by sentence-boundary splits.
      if (next.length > 0 && !/^\s*\d+[.)]\s*$/.test(next)) {
        segments.push(next);
      }
      buffer = "";
    };

    for (const rawLine of block.split(/\n+/)) {
      const line = rawLine.trim();
      if (line.length === 0) {
        flush();
        continue;
      }

      const numberedChunks = splitNumberedChunks(line);
      for (const chunk of numberedChunks) {
        const startsNewPhase =
          NUMBERED_MARKER_RE.test(chunk) || VERB_START_RE.test(chunk);
        if (startsNewPhase && buffer.trim().length > 0) flush();

        const sentenceParts = chunk.split(SENTENCE_BOUNDARY_RE);
        for (let i = 0; i < sentenceParts.length; i += 1) {
          const part = sentenceParts[i]!.trim();
          if (part.length === 0) continue;
          if (i > 0 && VERB_START_RE.test(part) && buffer.trim().length > 0) {
            flush();
          }
          buffer = buffer.length > 0 ? `${buffer} ${part}` : part;
        }
      }
    }

    flush();
    return segments;
  }
}

export const extractVerifyRules = (text: string): VerifyRule[] => {
  const rules: VerifyRule[] = [];
  if (/\btests?\b|\btests pass\b/i.test(text)) {
    rules.push({ kind: "tests", pattern: "all" });
  }
  if (/\b(?:build|compile)\b/i.test(text)) {
    rules.push({ kind: "command", command: "npm run build" });
  }
  if (/\btype(?:check)?\b/i.test(text)) {
    rules.push({ kind: "command", command: "npm run typecheck" });
  }
  return rules;
};

const splitNumberedChunks = (line: string): string[] => {
  const marker = new RegExp(`(?<!^)\\s+(?=${NUMBERED_MARKER_SOURCE})`, "gi");
  return line
    .split(marker)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
};

const stripNumberedMarker = (text: string): string =>
  text.replace(NUMBERED_MARKER_RE, "");

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 3)}...`;

const synthesizeObjective = (text: string): string => {
  const withoutPunctuation = text.replace(/[.!?]+$/g, "").trim();
  return withoutPunctuation.length > 0 ? withoutPunctuation : "Verify outcome";
};

const estimateXp = (text: string): number => {
  const numberedMarkers = text.match(new RegExp(NUMBERED_MARKER_SOURCE, "gi"));
  const sentenceStarts = text.match(
    new RegExp(`(?:^|[.!?]\\s+)(?:${VERB_SOURCE})\\b`, "gi"),
  );
  const detected =
    (numberedMarkers?.length ?? 0) + (sentenceStarts?.length ?? 0);
  return Math.min(250, 50 + 25 * detected);
};
