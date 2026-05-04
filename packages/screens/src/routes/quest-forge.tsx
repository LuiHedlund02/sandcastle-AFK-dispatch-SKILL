import type { JSX } from "react";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChromaticHeadline,
  CommandCardView,
  CrtRasterOverlay,
  FilmGrainOverlay,
  ModeCardView,
  OctaPanel,
  PhaseEditorList,
  ReactiveOperativeTile,
  SkillCardView,
} from "@sandcastle/ui";
import type { OperativeIdentity, ParsedPhase } from "@sandcastle/protocol";
import {
  useEngageQuestForge,
  useOperatives,
  useQuestForgeParse,
  useRepoDeck,
  useRepos,
} from "../api/queries";

/**
 * Quest Forge — Phase 3 wired editor.
 *
 * The user types a directive on the left; control-core's parser
 * (`POST /quest-forge/parse`, debounced 300ms) returns structured
 * `ParsedPhase`s on the right which the user can rename, reorder, attach
 * verify rules to, or delete. Clicking **Engage** fires
 * `POST /quest-forge/engage` with the (optionally edited) phases and
 * navigates to the new run's `/runs/:runId/combat` view.
 *
 * Dirty-edit semantics: as soon as the user touches a phase card the local
 * `phases` state is decoupled from the server response. Re-typing the
 * directive does NOT clobber edits — only an explicit "Reset to parser
 * output" action restores the server snapshot.
 */

const SAMPLE_DIRECTIVE = `Reproduce the failing auth refresh loop with a focused vitest case. Diagnose the race condition in src/auth/refresh.ts. Patch the call site to serialize concurrent callers through a single in-flight promise. Add a regression test that fans 50 concurrent callers and asserts a single network refresh. Commit with a changeset.`;

export function QuestForgeRoute(): JSX.Element {
  const [directive, setDirective] = useState<string>(SAMPLE_DIRECTIVE);
  const [editedPhases, setEditedPhases] = useState<readonly ParsedPhase[]>([]);
  const [dirty, setDirty] = useState(false);
  const directiveId = useId();
  const navigate = useNavigate();

  const reposQuery = useRepos();
  const operativesQuery = useOperatives();
  const repoId = reposQuery.data?.repos[0]?.id;
  const deckQuery = useRepoDeck(repoId);

  const parseQuery = useQuestForgeParse(directive);
  const engageMutation = useEngageQuestForge();

  // Sync server-parsed phases into local state when the user has not edited.
  useEffect(() => {
    if (dirty) return;
    if (parseQuery.data) setEditedPhases(parseQuery.data.phases);
  }, [parseQuery.data, dirty]);

  const phases = editedPhases;

  const charCount = directive.length;
  const phaseCount = phases.length;
  const totalXp = phases.reduce((acc, p) => acc + p.xpEstimate, 0);
  const verifyRuleCount = phases.reduce(
    (acc, p) => acc + p.verifyRules.length,
    0,
  );

  const onPhasesChange = (next: readonly ParsedPhase[]) => {
    setDirty(true);
    setEditedPhases(next);
  };

  const onResetEdits = () => {
    setDirty(false);
    if (parseQuery.data) setEditedPhases(parseQuery.data.phases);
  };

  const onEngage = () => {
    engageMutation.mutate(
      {
        directive,
        phases: dirty ? phases.map((p) => ({ ...p })) : undefined,
      },
      {
        onSuccess: ({ runId }) => {
          navigate(`/runs/${encodeURIComponent(runId)}/combat`);
        },
      },
    );
  };

  const canEngage =
    directive.trim().length > 0 &&
    !engageMutation.isPending &&
    parseQuery.status !== "pending";

  return (
    <section className="quest-forge" aria-labelledby={`${directiveId}-heading`}>
      <style>{QUEST_FORGE_CSS}</style>
      <CrtRasterOverlay />
      <FilmGrainOverlay />

      <header className="quest-forge__head">
        <div>
          <div className="eyebrow">quest forge / phase 3 wired</div>
          <ChromaticHeadline as="h1">
            <span id={`${directiveId}-heading`}>Forge a directive</span>
          </ChromaticHeadline>
          <p className="muted-copy">
            Compose a directive on the left; the backend parser previews
            structured phases on the right. Edit titles, objectives, and verify
            rules. Click <strong>Engage</strong> to dispatch a phased run and
            jump to the Combat view.
          </p>
        </div>
        <dl className="quest-forge__stats">
          <div>
            <dt>Chars</dt>
            <dd>{charCount}</dd>
          </div>
          <div>
            <dt>Phases</dt>
            <dd>{phaseCount}</dd>
          </div>
          <div>
            <dt>Verify rules</dt>
            <dd>{verifyRuleCount}</dd>
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
              <span className="mono-chip">
                {parseQuery.isFetching ? "parsing…" : "PARSER · LIVE"}
              </span>
            </div>
          }
          footer={
            <div className="quest-forge__editor-foot">
              <span className="mono-chip">CHARS {charCount}</span>
              <span className="mono-chip">PHASES {phaseCount}</span>
              <span className="muted-copy" aria-live="polite">
                {parseQuery.error
                  ? `Parser error: ${parseQuery.error.message}`
                  : dirty
                    ? "Edited locally — server output ignored."
                    : "Phases auto-update from the backend parser."}
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
            Backend parser splits on sentence boundaries, numbered lists, and
            imperative verbs and attaches default verify rules.
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
              <ChromaticHeadline as="h2">Phase editor</ChromaticHeadline>
              <span className="mono-chip">{phaseCount} PHASES</span>
            </div>
          }
          footer={
            <div className="quest-forge__editor-foot">
              <button
                type="button"
                className="quest-forge__engage"
                onClick={onEngage}
                disabled={!canEngage}
              >
                {engageMutation.isPending ? "Engaging…" : "Engage"}
              </button>
              {dirty ? (
                <button
                  type="button"
                  className="quest-forge__reset"
                  onClick={onResetEdits}
                >
                  Reset edits
                </button>
              ) : null}
              {engageMutation.error ? (
                <span className="muted-copy" role="alert">
                  Engage failed: {engageMutation.error.message}
                </span>
              ) : null}
            </div>
          }
        >
          {parseQuery.isLoading && phases.length === 0 ? (
            <p className="muted-copy" role="status">
              Parsing directive…
            </p>
          ) : (
            <PhaseEditorList phases={phases} onChange={onPhasesChange} />
          )}
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
            (selection picks the first available operative for now)
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
.quest-forge__engage {
  font-family: var(--display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 8px 18px;
  color: var(--frost);
  background: linear-gradient(180deg, var(--magenta), #c01568);
  border: 1px solid var(--magenta);
  cursor: pointer;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
.quest-forge__engage:hover:not(:disabled) {
  box-shadow: 0 0 18px rgba(255, 46, 136, 0.35);
}
.quest-forge__engage:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.quest-forge__reset {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--mist);
  background: var(--hull-2);
  border: 1px solid var(--rule-2);
  padding: 6px 10px;
  cursor: pointer;
}
.quest-forge__reset:hover {
  color: var(--cyan);
  border-color: var(--cyan-dim);
}
.quest-forge__operative-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
`;
