import type { JSX } from "react";
import { useId, useMemo, useState } from "react";
import {
  ChromaticHeadline,
  CommandCardView,
  CrtRasterOverlay,
  FilmGrainOverlay,
  ModeCardView,
  OctaPanel,
  ReactiveOperativeTile,
  SkillCardView,
} from "@sandcastle/ui";
import type { OperativeIdentity } from "@sandcastle/protocol";
import { useOperatives, useRepoDeck, useRepos } from "../api/queries";

/**
 * Quest Forge — Phase 1 read-only screen.
 *
 * The user types a directive and sees a heuristic phase preview generated
 * locally. There is NO run dispatch, NO mutation, NO persistence: the
 * directive lives entirely in local React state. The deck strip on the
 * left and the operative strip on the right are fed by `useRepoDeck` and
 * `useOperatives` from control-core; the parser preview in the centre is
 * a deterministic stub (see {@link parseDirectiveStub}) that exists only
 * to demonstrate the editor + preview UX. The real parser ships in
 * Phase 3 (LLM-or-deterministic) and will replace the stub call site.
 */

interface PreviewPhase {
  readonly id: string;
  readonly ordinal: number;
  readonly title: string;
  readonly directiveSlice: string;
  readonly objective: string;
  readonly xpEstimate: number;
  readonly verifyRules: readonly string[];
  readonly detectedVerb: string | null;
}

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
];

const NUMBERED_LIST_RE = /^\s*(?:\d+[.)]\s+|step\s+\d+\s*:\s+)/i;

/**
 * **Phase 1 placeholder parser** — splits a directive into preview phases
 * via three heuristics:
 *  - Sentence boundaries (`. `, `\n\n`)
 *  - Imperative verb starts ("Add", "Fix", "Refactor", "Test", "Document", ...)
 *  - Numbered lists ("1.", "2.", "Step 1:")
 *
 * Each phase gets a 60-char title slice, the full segment as `directiveSlice`,
 * a placeholder objective ("verify <verb>"), an xpEstimate (50 base, +25 if
 * an imperative verb is detected at the head), and an empty verifyRules array.
 * This is intentionally honest — it is NOT the real parser. Phase 3 will
 * replace this with a deterministic-or-LLM parser shipped in control-core.
 */
function parseDirectiveStub(directive: string): readonly PreviewPhase[] {
  const trimmed = directive.trim();
  if (trimmed.length === 0) return [];

  // First split on hard breaks (blank lines), then on sentence boundaries
  // and numbered-list / imperative-verb starts within each block.
  const blocks = trimmed
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const segments: string[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let buffer = "";
    const flush = () => {
      const out = buffer.trim();
      if (out.length > 0) segments.push(out);
      buffer = "";
    };

    for (const line of lines) {
      const startsList = NUMBERED_LIST_RE.test(line);
      const startsVerb = IMPERATIVE_VERBS.some((v) =>
        new RegExp(`^${v}\\b`, "i").test(line),
      );
      if ((startsList || startsVerb) && buffer.trim().length > 0) {
        flush();
      }
      // Within the line, also split on sentence boundaries ". " when the
      // following sentence starts with an imperative verb.
      const parts = line.split(/(?<=[.!?])\s+(?=[A-Z])/);
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i] ?? "";
        const startsVerbPart = IMPERATIVE_VERBS.some((v) =>
          new RegExp(`^${v}\\b`, "i").test(part),
        );
        if (i > 0 && startsVerbPart && buffer.trim().length > 0) {
          flush();
        }
        buffer = buffer.length > 0 ? `${buffer} ${part}` : part;
      }
      flush();
    }
    flush();
  }

  if (segments.length === 0) {
    segments.push(trimmed);
  }

  return segments.map((slice, idx): PreviewPhase => {
    const verbMatch = IMPERATIVE_VERBS.find((v) =>
      new RegExp(`^${v}\\b`, "i").test(slice),
    );
    const detectedVerb = verbMatch ?? null;
    const titleRaw = slice.replace(/\s+/g, " ").trim();
    const title =
      titleRaw.length <= 60 ? titleRaw : `${titleRaw.slice(0, 57)}...`;
    const objective = detectedVerb
      ? `verify ${detectedVerb.toLowerCase()}`
      : "verify outcome";
    const xpEstimate = 50 + (detectedVerb ? 25 : 0);
    return {
      id: `preview-${idx + 1}`,
      ordinal: idx + 1,
      title,
      directiveSlice: slice,
      objective,
      xpEstimate,
      verifyRules: [],
      detectedVerb,
    };
  });
}

const ROMAN = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

function toRoman(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

const SAMPLE_DIRECTIVE = `Reproduce the failing auth refresh loop with a focused vitest case. Diagnose the race condition in src/auth/refresh.ts. Patch the call site to serialize concurrent callers through a single in-flight promise. Add a regression test that fans 50 concurrent callers and asserts a single network refresh. Commit with a changeset.`;

export function QuestForgeRoute(): JSX.Element {
  const [directive, setDirective] = useState<string>(SAMPLE_DIRECTIVE);
  const directiveId = useId();

  const reposQuery = useRepos();
  const operativesQuery = useOperatives();

  const repoId = reposQuery.data?.repos[0]?.id;
  const deckQuery = useRepoDeck(repoId);

  const phases = useMemo(() => parseDirectiveStub(directive), [directive]);

  const charCount = directive.length;
  const verbCount = phases.filter((p) => p.detectedVerb !== null).length;
  const totalXp = phases.reduce((acc, p) => acc + p.xpEstimate, 0);

  return (
    <section className="quest-forge" aria-labelledby={`${directiveId}-heading`}>
      <style>{QUEST_FORGE_CSS}</style>
      <CrtRasterOverlay />
      <FilmGrainOverlay />

      <header className="quest-forge__head">
        <div>
          <div className="eyebrow">quest forge / phase 1 preview</div>
          <ChromaticHeadline as="h1">
            <span id={`${directiveId}-heading`}>Forge a directive</span>
          </ChromaticHeadline>
          <p className="muted-copy">
            Compose a directive on the left; the heuristic parser previews the
            phases on the right. Phase 1 does not dispatch runs.
          </p>
        </div>
        <dl className="quest-forge__stats">
          <div>
            <dt>Chars</dt>
            <dd>{charCount}</dd>
          </div>
          <div>
            <dt>Verbs</dt>
            <dd>{verbCount}</dd>
          </div>
          <div>
            <dt>Phases</dt>
            <dd>{phases.length}</dd>
          </div>
          <div>
            <dt>Total XP</dt>
            <dd>{totalXp}</dd>
          </div>
        </dl>
      </header>

      <div className="quest-forge__grid">
        <DeckStrip
          isLoading={reposQuery.isLoading || deckQuery.isLoading}
          error={reposQuery.error ?? deckQuery.error ?? null}
          deck={deckQuery.data ?? null}
          repoId={repoId ?? null}
        />

        <OctaPanel
          tone="cyan"
          eyebrow={
            <>
              <span aria-hidden="true">0x01</span>
              <span>Compose</span>
            </>
          }
          header={
            <div className="quest-forge__editor-head">
              <ChromaticHeadline as="h2">Directive</ChromaticHeadline>
              <span className="mono-chip">PARSER · STUB</span>
            </div>
          }
          footer={
            <div className="quest-forge__editor-foot">
              <span className="mono-chip">CHARS {charCount}</span>
              <span className="mono-chip">VERBS {verbCount}</span>
              <span className="mono-chip">PHASES {phases.length}</span>
              <span className="muted-copy" aria-live="polite">
                Phase 1 preview: this editor does not dispatch runs.
              </span>
            </div>
          }
        >
          <label className="quest-forge__editor-label" htmlFor={directiveId}>
            <span className="eyebrow">Directive body</span>
            <textarea
              id={directiveId}
              className="quest-forge__textarea"
              value={directive}
              onChange={(event) => setDirective(event.target.value)}
              spellCheck={false}
              rows={14}
              placeholder="Describe the work. Use sentences, numbered lists, or imperative verbs (Add, Fix, Refactor, Test, Document)."
              aria-describedby={`${directiveId}-hint`}
            />
          </label>
          <p
            id={`${directiveId}-hint`}
            className="muted-copy quest-forge__hint"
          >
            The parser splits on sentence boundaries, numbered lists, and
            imperative verbs. Output is heuristic only.
          </p>
        </OctaPanel>

        <OctaPanel
          tone="magenta"
          eyebrow={
            <>
              <span aria-hidden="true">0x02</span>
              <span>Forge</span>
            </>
          }
          header={
            <div className="quest-forge__preview-head">
              <ChromaticHeadline as="h2">Phase preview</ChromaticHeadline>
              <span className="mono-chip">{phases.length} PHASES</span>
            </div>
          }
        >
          <PhasePreview phases={phases} />
        </OctaPanel>
      </div>

      <OperativeStrip
        isLoading={operativesQuery.isLoading}
        error={operativesQuery.error ?? null}
        operatives={operativesQuery.data?.operatives ?? null}
      />
    </section>
  );
}

function DeckStrip({
  isLoading,
  error,
  deck,
  repoId,
}: {
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly deck: import("@sandcastle/protocol").Deck | null;
  readonly repoId: string | null;
}): JSX.Element {
  let body: JSX.Element;
  if (isLoading) {
    body = (
      <p className="muted-copy" role="status">
        Loading deck…
      </p>
    );
  } else if (error) {
    body = (
      <p className="muted-copy" role="alert">
        Failed to load deck: {error.message}
      </p>
    );
  } else if (!repoId) {
    body = (
      <p className="muted-copy" role="status">
        No repo registered with control-core.
      </p>
    );
  } else if (!deck) {
    body = (
      <p className="muted-copy" role="status">
        No deck snapshot for repo {repoId}.
      </p>
    );
  } else {
    const enabledSkills = deck.skills.filter((s) => s.enabled);
    const enabledCommands = deck.commands.filter((c) => c.enabled);
    body = (
      <div className="quest-forge__deck-list">
        <ModeCardView card={deck.mode} active={deck.mode.enabled} />
        {enabledSkills.length === 0 ? null : (
          <div className="quest-forge__deck-group">
            <div className="eyebrow">skills · {enabledSkills.length}</div>
            {enabledSkills.slice(0, 4).map((skill) => (
              <SkillCardView key={skill.id} card={skill} />
            ))}
          </div>
        )}
        {enabledCommands.length === 0 ? null : (
          <div className="quest-forge__deck-group">
            <div className="eyebrow">commands · {enabledCommands.length}</div>
            {enabledCommands.slice(0, 4).map((cmd) => (
              <CommandCardView key={cmd.id} card={cmd} />
            ))}
          </div>
        )}
        {enabledSkills.length === 0 && enabledCommands.length === 0 ? (
          <p className="muted-copy">No skill or command cards enabled.</p>
        ) : null}
      </div>
    );
  }

  return (
    <OctaPanel
      tone="plasma"
      eyebrow={
        <>
          <span aria-hidden="true">0x00</span>
          <span>Deck</span>
        </>
      }
      header={
        <div className="quest-forge__deck-head">
          <ChromaticHeadline as="h2">Loadout</ChromaticHeadline>
          {repoId ? <span className="mono-chip">{repoId}</span> : null}
        </div>
      }
      className="quest-forge__deck-panel"
    >
      {body}
    </OctaPanel>
  );
}

function PhasePreview({
  phases,
}: {
  readonly phases: readonly PreviewPhase[];
}): JSX.Element {
  if (phases.length === 0) {
    return (
      <p className="muted-copy" role="status">
        No phases yet — type a directive on the left.
      </p>
    );
  }
  return (
    <ol className="quest-forge__phase-list">
      {phases.map((phase) => (
        <li key={phase.id} className="quest-forge__phase">
          <header className="quest-forge__phase-head">
            <span className="quest-forge__phase-roman" aria-hidden="true">
              {toRoman(phase.ordinal)}
            </span>
            <div className="quest-forge__phase-title">
              <div className="eyebrow">
                Phase {toRoman(phase.ordinal)}
                {phase.detectedVerb ? ` · ${phase.detectedVerb}` : ""}
              </div>
              <strong>{phase.title}</strong>
            </div>
            <span className="mono-chip">+{phase.xpEstimate} XP</span>
          </header>
          <p className="quest-forge__phase-slice">{phase.directiveSlice}</p>
          <dl className="quest-forge__phase-meta">
            <div>
              <dt>Objective</dt>
              <dd>{phase.objective}</dd>
            </div>
            <div>
              <dt>Verify rules</dt>
              <dd>
                {phase.verifyRules.length === 0
                  ? "—"
                  : phase.verifyRules.join(", ")}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

function OperativeStrip({
  isLoading,
  error,
  operatives,
}: {
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly operatives: readonly OperativeIdentity[] | null;
}): JSX.Element {
  let body: JSX.Element;
  if (isLoading) {
    body = (
      <p className="muted-copy" role="status">
        Loading operatives…
      </p>
    );
  } else if (error) {
    body = (
      <p className="muted-copy" role="alert">
        Failed to load operatives: {error.message}
      </p>
    );
  } else if (!operatives || operatives.length === 0) {
    body = (
      <p className="muted-copy" role="status">
        No operatives registered.
      </p>
    );
  } else {
    body = (
      <div className="quest-forge__operative-row">
        {operatives.slice(0, 6).map((op) => (
          <ReactiveOperativeTile key={op.id} operative={op} microState="idle" />
        ))}
      </div>
    );
  }

  return (
    <OctaPanel
      tone="amber"
      eyebrow={
        <>
          <span aria-hidden="true">0x03</span>
          <span>Operatives</span>
        </>
      }
      header={
        <div className="quest-forge__deck-head">
          <ChromaticHeadline as="h2">Available operatives</ChromaticHeadline>
          <span className="muted-copy">
            (selection is Phase 2 — preview only)
          </span>
        </div>
      }
      className="quest-forge__operative-panel"
    >
      {body}
    </OctaPanel>
  );
}

const QUEST_FORGE_CSS = `
.quest-forge {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 18px;
  min-height: 100%;
}
.quest-forge__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.quest-forge__head h1 {
  margin: 8px 0 8px;
  font-size: 30px;
  line-height: 1.1;
}
.quest-forge__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(72px, auto));
  gap: 14px;
  margin: 0;
}
.quest-forge__stats div {
  border: 1px solid var(--rule-2);
  background: var(--hull-1);
  padding: 8px 12px;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}
.quest-forge__stats dt {
  color: var(--steel);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.quest-forge__stats dd {
  margin: 4px 0 0;
  font-family: var(--display);
  font-size: 18px;
  color: var(--frost);
}
.quest-forge__grid {
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.4fr) minmax(0, 1.2fr);
  gap: 18px;
  min-height: 0;
}
@media (max-width: 1100px) {
  .quest-forge__grid {
    grid-template-columns: 1fr;
  }
}
.quest-forge__deck-panel,
.quest-forge__operative-panel {
  min-height: 0;
}
.quest-forge__deck-head,
.quest-forge__editor-head,
.quest-forge__preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.quest-forge__deck-head h2,
.quest-forge__editor-head h2,
.quest-forge__preview-head h2 {
  font-size: 18px;
  margin: 0;
}
.quest-forge__deck-list {
  display: grid;
  gap: 10px;
}
.quest-forge__deck-group {
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--rule-2);
  padding-top: 10px;
}
.quest-forge__editor-label {
  display: grid;
  gap: 6px;
}
.quest-forge__textarea {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  border: 1px solid var(--rule-3);
  background: var(--hull-1);
  color: var(--frost);
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.55;
  outline: none;
  caret-color: var(--cyan);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
.quest-forge__textarea:focus-visible {
  border-color: var(--cyan);
  box-shadow: 0 0 0 1px var(--cyan-dim), 0 0 18px rgba(86, 212, 224, 0.18);
}
.quest-forge__editor-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.quest-forge__hint {
  margin: 8px 0 0;
  font-size: 11px;
}
.quest-forge__phase-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.quest-forge__phase {
  border: 1px solid var(--rule-2);
  background: var(--hull-1);
  padding: 12px 14px;
  display: grid;
  gap: 8px;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}
.quest-forge__phase-head {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 12px;
}
.quest-forge__phase-roman {
  font-family: var(--display);
  font-size: 22px;
  color: var(--magenta);
  letter-spacing: 0.05em;
  text-shadow: 0 0 12px rgba(255, 46, 136, 0.35);
}
.quest-forge__phase-title strong {
  display: block;
  font-family: var(--display);
  font-size: 14px;
  color: var(--frost);
  letter-spacing: 0.02em;
  margin-top: 2px;
}
.quest-forge__phase-slice {
  margin: 0;
  color: var(--mist);
  font-size: 12px;
  border-left: 2px solid var(--cyan-dim);
  padding-left: 10px;
}
.quest-forge__phase-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px 18px;
  margin: 0;
}
.quest-forge__phase-meta dt {
  color: var(--steel);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.quest-forge__phase-meta dd {
  margin: 2px 0 0;
  color: var(--mist);
  font-size: 12px;
}
.quest-forge__operative-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
`;
