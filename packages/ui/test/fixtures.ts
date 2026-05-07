import type {
  CommandCard,
  ModeCard,
  Planet,
  Run,
  RunStatus,
  SkillCard,
} from "@sandcastle/protocol";

export function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run_test",
    planetId: "planet_test",
    operativeId: "op_test",
    provider: "claude-code",
    sandboxProvider: "no-sandbox",
    status: "casting",
    directive: "fix the flaky test",
    branch: "sandcastle/run_test",
    worktreePath: undefined,
    startedAt: new Date(0).toISOString(),
    endedAt: null,
    phaseIds: [],
    currentPhaseId: null,
    verification: { allGreen: false, failedChecks: [] },
    totals: { toolCalls: 0, filesEdited: 0, commandsRun: 0 },
    ...overrides,
  };
}

export const allStatuses: readonly RunStatus[] = [
  "queued",
  "starting",
  "casting",
  "striking",
  "verifying",
  "win-pending",
  "fail-pending",
  "victory",
  "defeat",
  "aborted",
];

export function makeMode(overrides: Partial<ModeCard> = {}): ModeCard {
  return {
    id: "mode_test",
    type: "mode",
    slug: "default",
    title: "Default mode",
    summary: "The standard operative behaviour",
    sourcePath: ".sandcastle/agents.md",
    enabled: true,
    tags: [],
    body: "# Default mode\n\nDo the right thing.",
    updatedAt: new Date(0).toISOString(),
    constraints: ["respect tests"],
    ...overrides,
  };
}

export function makeSkill(overrides: Partial<SkillCard> = {}): SkillCard {
  return {
    id: "skill_test",
    type: "skill",
    slug: "verify-tests",
    title: "Verify tests",
    summary: "Run tests after every patch",
    sourcePath: ".sandcastle/skills/verify-tests.md",
    enabled: true,
    tags: [],
    body: "# Verify tests\n\nrun npm test",
    updatedAt: new Date(0).toISOString(),
    passive: true as const,
    triggerHints: ["after edit"],
    ...overrides,
  };
}

export function makeCommand(overrides: Partial<CommandCard> = {}): CommandCard {
  return {
    id: "cmd_test",
    type: "command",
    slug: "deploy",
    title: "Deploy",
    summary: "Deploy the change",
    sourcePath: ".sandcastle/commands/deploy.md",
    enabled: true,
    tags: [],
    body: "# Deploy\n\nrun the thing",
    updatedAt: new Date(0).toISOString(),
    slashCommand: "/deploy",
    verifyHints: ["smoke check"],
    ...overrides,
  };
}

export function makePlanet(overrides: Partial<Planet> = {}): Planet {
  const mode = makeMode();
  return {
    id: "planet_test",
    repoName: "sandcastle",
    repoRoot: "/repos/sandcastle",
    defaultBranch: "main",
    terraformStage: 3,
    scars: [],
    wards: [],
    deck: {
      version: 1,
      mode,
      skills: [makeSkill()],
      commands: [makeCommand()],
      order: [mode.id],
    },
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
    ...overrides,
  };
}
