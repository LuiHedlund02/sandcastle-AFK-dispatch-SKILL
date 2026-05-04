import { relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  Deck,
  OperativeIdentity,
  Planet,
  Run,
} from "@sandcastle/protocol";
import type { AgentProviderAdapter } from "../../src/adapters/AgentProviderAdapter.js";

export const runConformance = (adapter: AgentProviderAdapter): void => {
  describe(`${adapter.id} conformance`, () => {
    it("materializes a provider-neutral deck without orphaned files", async () => {
      const output = await adapter.materialize(fixtureInput(adapter.id));

      expect(output.files.length).toBeGreaterThan(0);
      for (const file of output.files) {
        expect(file.relativePath).not.toMatch(/^[/\\]/);
        expect(file.relativePath.split(/[\\/]+/g)).not.toContain("..");
        expect(file.content.trim().length).toBeGreaterThan(0);
        expect(isCovered(file.relativePath, output.cleanupPaths ?? [])).toBe(
          true,
        );
      }
    });
  });
};

export const fixtureInput = (
  provider: OperativeIdentity["provider"] = "codex",
) => {
  const deck = fixtureDeck();
  const run: Run = {
    id: "run-fixture",
    planetId: "planet-fixture",
    operativeId: "operative-fixture",
    provider,
    sandboxProvider: "host-bind-mount",
    status: "queued",
    directive: "Ship the fixture",
    branch: "sandcastle/run-fixture",
    startedAt: "2026-05-04T00:00:00.000Z",
    endedAt: null,
    phaseIds: [],
    currentPhaseId: null,
    verification: { allGreen: false, failedChecks: [] },
    totals: { toolCalls: 0, filesEdited: 0, commandsRun: 0 },
  };
  const planet: Planet = {
    id: "planet-fixture",
    repoName: "fixture",
    repoRoot: "/repo",
    defaultBranch: "main",
    terraformStage: 0,
    scars: [],
    wards: [],
    deck,
    telemetry: {
      coveragePct: null,
      ciGreenRate30d: null,
      openIssues: null,
      churnScore: null,
      ageDays: null,
      testCount: null,
      branch: "main",
      lastCommitAt: null,
      lastIndexedAt: null,
    },
    activeRunIds: [],
    lastRunAt: null,
  };
  return {
    repoRoot: "/repo",
    sandcastleDir: "/repo/.sandcastle",
    deck,
    planet,
    operative: {
      id: "operative-fixture",
      codename: "Nyx",
      provider,
      model: "test-model",
      species: "synthetic",
      className: "Builder",
      level: 3,
      globalXp: 100,
      bond: 4,
      streak: 2,
      concurrencyCap: 5,
      sleeveCardIds: [],
      unlockedTraits: [],
    },
    run,
    directive: "Ship the fixture",
  };
};

const fixtureDeck = (): Deck => ({
  version: 1,
  mode: {
    id: "mode-build",
    type: "mode",
    slug: "build",
    title: "Build Mode",
    summary: "Build safely",
    sourcePath: ".sandcastle/agents.md",
    enabled: true,
    tags: ["mode"],
    body: "Build the requested change with focused tests.",
    updatedAt: "2026-05-04T00:00:00.000Z",
    constraints: ["Keep changes scoped"],
  },
  skills: [
    {
      id: "skill-tests",
      type: "skill",
      slug: "tests",
      title: "Test Reader",
      summary: "Read existing tests",
      sourcePath: ".sandcastle/skills/tests.md",
      enabled: true,
      tags: ["testing"],
      body: "Inspect nearby tests before adding coverage.",
      updatedAt: "2026-05-04T00:00:00.000Z",
      passive: true,
      triggerHints: ["testing"],
    },
    {
      id: "skill-scope",
      type: "skill",
      slug: "scope",
      title: "Scope Keeper",
      summary: "Keep edits small",
      sourcePath: ".sandcastle/skills/scope.md",
      enabled: true,
      tags: ["quality"],
      body: "Avoid unrelated refactors.",
      updatedAt: "2026-05-04T00:00:00.000Z",
      passive: true,
      triggerHints: ["planning"],
    },
  ],
  commands: [
    {
      id: "command-verify",
      type: "command",
      slug: "verify",
      title: "Verify",
      summary: "Run verification",
      sourcePath: ".sandcastle/commands/verify.md",
      enabled: true,
      tags: ["testing"],
      body: "Run the relevant test command and report the result.",
      updatedAt: "2026-05-04T00:00:00.000Z",
      slashCommand: "/verify",
      verifyHints: ["npm test"],
    },
    {
      id: "command-summarize",
      type: "command",
      slug: "summarize",
      title: "Summarize",
      summary: "Summarize changes",
      sourcePath: ".sandcastle/commands/summarize.md",
      enabled: true,
      tags: ["reporting"],
      body: "Summarize files changed and verification.",
      updatedAt: "2026-05-04T00:00:00.000Z",
      slashCommand: "/summarize",
      verifyHints: [],
    },
  ],
  order: [
    "mode-build",
    "skill-tests",
    "skill-scope",
    "command-verify",
    "command-summarize",
  ],
});

const isCovered = (
  filePath: string,
  cleanupPaths: readonly string[],
): boolean =>
  cleanupPaths.some((cleanupPath) => {
    const normalizedCleanup = cleanupPath.replace(/\\/g, "/");
    const normalizedFile = filePath.replace(/\\/g, "/");
    if (normalizedCleanup.endsWith("/")) {
      return normalizedFile.startsWith(normalizedCleanup);
    }
    const back = relative(normalizedCleanup, normalizedFile);
    return back === "" || (!back.startsWith("..") && !back.startsWith(sep));
  });
