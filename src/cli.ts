import { Command, Options } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import * as clack from "@clack/prompts";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { styleText } from "node:util";

import { Display } from "./Display.js";
import { run as runSandcastle } from "./run.js";
import { pi } from "./AgentProvider.js";
import { docker } from "./sandboxes/docker.js";
import { podman } from "./sandboxes/podman.js";
import { buildImage, removeImage } from "./DockerLifecycle.js";
import {
  buildImage as podmanBuildImage,
  removeImage as podmanRemoveImage,
} from "./PodmanLifecycle.js";
import {
  scaffold,
  listTemplates,
  listAgents,
  getAgent,
  listBacklogManagers,
  getBacklogManager,
  listSandboxProviders,
  getSandboxProvider,
  getNextStepsLines,
} from "./InitService.js";
import { defaultImageName } from "./sandboxes/docker.js";
import type {
  AgentEntry,
  BacklogManagerEntry,
  SandboxProviderEntry,
} from "./InitService.js";
import { ConfigDirError, InitError } from "./errors.js";

const require = createRequire(import.meta.url);
const VERSION = (require("../package.json") as { version: string }).version;

// --- Shared options ---

const imageNameOption = Options.text("image-name").pipe(
  Options.withDescription("Docker image name"),
  Options.optional,
);

const resolveImageName = (
  cliFlag: import("effect").Option.Option<string>,
  cwd: string,
): string => (cliFlag._tag === "Some" ? cliFlag.value : defaultImageName(cwd));

// --- Config directory check ---

const CONFIG_DIR = ".sandcastle";

const requireConfigDir = (
  cwd: string,
): Effect.Effect<void, ConfigDirError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs
      .exists(join(cwd, CONFIG_DIR))
      .pipe(Effect.catchAll(() => Effect.succeed(false)));
    if (!exists) {
      yield* Effect.fail(
        new ConfigDirError({
          message: "No .sandcastle/ found. Run `sandcastle init` first.",
        }),
      );
    }
  });

// --- Init command ---

const templateOption = Options.text("template").pipe(
  Options.withDescription(
    "Template to scaffold (e.g. blank, simple-loop, parallel-planner)",
  ),
  Options.optional,
);

const agentOption = Options.text("agent").pipe(
  Options.withDescription("Agent to use (e.g. claude-code)"),
  Options.optional,
);

const initModelOption = Options.text("model").pipe(
  Options.withDescription(
    "Model to use for the agent (e.g. claude-sonnet-4-6). Defaults to the agent's default model",
  ),
  Options.optional,
);

const sandboxProviderOption = Options.text("sandbox-provider").pipe(
  Options.withDescription("Sandbox provider to use (docker or podman)"),
  Options.optional,
);

const backlogManagerOption = Options.text("backlog-manager").pipe(
  Options.withDescription("Backlog manager to use (github-issues or beads)"),
  Options.optional,
);

const createLabelOption = Options.boolean("create-label", {
  ifPresent: true,
  negationNames: ["no-create-label"],
}).pipe(
  Options.withDescription(
    'Create the "Sandcastle" GitHub label when using GitHub Issues',
  ),
  Options.optional,
);

const buildImageNowOption = Options.boolean("build-image", {
  ifPresent: true,
  negationNames: ["no-build-image"],
}).pipe(
  Options.withDescription("Build the sandbox image during init"),
  Options.optional,
);

const runNowOption = Options.boolean("run", {
  ifPresent: true,
  negationNames: ["no-run"],
}).pipe(
  Options.withDescription("Start the AFK run after setup"),
  Options.optional,
);

const initCommand = Command.make(
  "init",
  {
    imageName: imageNameOption,
    template: templateOption,
    agent: agentOption,
    model: initModelOption,
    sandboxProvider: sandboxProviderOption,
    backlogManager: backlogManagerOption,
    createLabel: createLabelOption,
    buildImageNow: buildImageNowOption,
  },
  ({
    imageName: imageNameFlag,
    template,
    agent: agentFlag,
    model: modelFlag,
    sandboxProvider: sandboxProviderFlag,
    backlogManager: backlogManagerFlag,
    createLabel: createLabelFlag,
    buildImageNow: buildImageNowFlag,
  }) =>
    Effect.gen(function* () {
      const d = yield* Display;
      const cwd = process.cwd();
      const imageName = resolveImageName(imageNameFlag, cwd);

      // Early validation of CLI flags before interactive prompts
      const templates = listTemplates();
      if (template._tag === "Some") {
        const valid = templates.find((tmpl) => tmpl.name === template.value);
        if (!valid) {
          const names = templates.map((tmpl) => tmpl.name).join(", ");
          yield* Effect.fail(
            new InitError({
              message: `Unknown template "${template.value}". Available: ${names}`,
            }),
          );
        }
      }

      // Resolve agent: CLI flag > interactive select
      const agents = listAgents();
      let selectedAgent: AgentEntry;
      if (agentFlag._tag === "Some") {
        const entry = getAgent(agentFlag.value);
        if (!entry) {
          const names = agents.map((a) => a.name).join(", ");
          yield* Effect.fail(
            new InitError({
              message: `Unknown agent "${agentFlag.value}". Available: ${names}`,
            }),
          );
        }
        selectedAgent = entry!;
      } else {
        const selected = yield* Effect.promise(() =>
          clack.select({
            message: "Select an agent:",
            initialValue: "claude-code",
            options: agents.map((a) => ({
              value: a.name,
              label: a.label,
              hint: `Default model: ${a.defaultModel}`,
            })),
          }),
        );
        if (clack.isCancel(selected)) {
          yield* Effect.fail(
            new InitError({ message: "Agent selection cancelled." }),
          );
        }
        selectedAgent = getAgent(selected as string)!;
      }

      // Resolve model: CLI flag > agent default
      const selectedModel =
        modelFlag._tag === "Some"
          ? modelFlag.value
          : selectedAgent.defaultModel;

      // Resolve sandbox provider: CLI flag > interactive select
      const sandboxProviders = listSandboxProviders();
      let selectedSandboxProvider: SandboxProviderEntry;
      if (sandboxProviderFlag._tag === "Some") {
        const entry = getSandboxProvider(sandboxProviderFlag.value);
        if (!entry) {
          const names = sandboxProviders.map((p) => p.name).join(", ");
          yield* Effect.fail(
            new InitError({
              message: `Unknown sandbox provider "${sandboxProviderFlag.value}". Available: ${names}`,
            }),
          );
        }
        selectedSandboxProvider = entry!;
      } else {
        const selected = yield* Effect.promise(() =>
          clack.select({
            message: "Select a sandbox provider:",
            options: sandboxProviders.map((p) => ({
              value: p.name,
              label: p.label,
            })),
          }),
        );
        if (clack.isCancel(selected)) {
          yield* Effect.fail(
            new InitError({
              message: "Sandbox provider selection cancelled.",
            }),
          );
        }
        selectedSandboxProvider = getSandboxProvider(selected as string)!;
      }

      // Resolve backlog manager: CLI flag > interactive select
      const backlogManagers = listBacklogManagers();
      let selectedBacklogManager: BacklogManagerEntry;
      if (backlogManagerFlag._tag === "Some") {
        const entry = getBacklogManager(backlogManagerFlag.value);
        if (!entry) {
          const names = backlogManagers.map((b) => b.name).join(", ");
          yield* Effect.fail(
            new InitError({
              message: `Unknown backlog manager "${backlogManagerFlag.value}". Available: ${names}`,
            }),
          );
        }
        selectedBacklogManager = entry!;
      } else {
        const selected = yield* Effect.promise(() =>
          clack.select({
            message: "Select a backlog manager:",
            initialValue: "github-issues",
            options: backlogManagers.map((b) => ({
              value: b.name,
              label: b.label,
            })),
          }),
        );
        if (clack.isCancel(selected)) {
          yield* Effect.fail(
            new InitError({
              message: "Backlog manager selection cancelled.",
            }),
          );
        }
        selectedBacklogManager = getBacklogManager(selected as string)!;
      }

      // Resolve template: CLI flag > interactive select (already validated above)
      let selectedTemplate: string;
      if (template._tag === "Some") {
        selectedTemplate = template.value;
      } else {
        const selected = yield* Effect.promise(() =>
          clack.select({
            message: "Select a template:",
            initialValue: "blank",
            options: templates.map((tmpl) => ({
              value: tmpl.name,
              label: tmpl.name,
              hint: tmpl.description,
            })),
          }),
        );
        if (clack.isCancel(selected)) {
          yield* Effect.fail(
            new InitError({ message: "Template selection cancelled." }),
          );
        }
        selectedTemplate = selected as string;
      }

      // Offer to create the "Sandcastle" label on the repo (skip for non-GitHub backlog managers)
      let shouldCreateLabel: boolean | symbol = false;
      if (selectedBacklogManager.name === "github-issues") {
        shouldCreateLabel =
          createLabelFlag._tag === "Some"
            ? createLabelFlag.value
            : yield* Effect.promise(() =>
                clack.confirm({
                  message:
                    'Create a "Sandcastle" GitHub label? (Templates filter issues by this label)',
                  initialValue: true,
                }),
              );

        if (shouldCreateLabel === true) {
          yield* Effect.try({
            try: () =>
              execSync(
                'gh label create "Sandcastle" --description "Issues for Sandcastle to work on" --color "F9A825" 2>/dev/null',
                { cwd, stdio: "ignore" },
              ),
            catch: () => undefined,
          }).pipe(Effect.ignore);
        }
      }

      const scaffoldResult = yield* d.spinner(
        "Scaffolding .sandcastle/ config directory...",
        scaffold(cwd, {
          agent: selectedAgent,
          model: selectedModel,
          templateName: selectedTemplate,
          createLabel: shouldCreateLabel === true,
          backlogManager: selectedBacklogManager,
          sandboxProvider: selectedSandboxProvider,
        }).pipe(
          Effect.mapError(
            (e) =>
              new InitError({
                message: `${e instanceof Error ? e.message : e}`,
              }),
          ),
        ),
      );

      // Prompt user before building image
      const providerLabel = selectedSandboxProvider.label;
      const shouldBuild =
        buildImageNowFlag._tag === "Some"
          ? buildImageNowFlag.value
          : yield* Effect.promise(() =>
              clack.confirm({
                message: `Build the default ${providerLabel} image now?`,
                initialValue: true,
              }),
            );

      if (shouldBuild === true) {
        const containerfileDir = join(cwd, CONFIG_DIR);
        if (selectedSandboxProvider.name === "podman") {
          yield* d.spinner(
            `Building ${providerLabel} image '${imageName}'...`,
            podmanBuildImage(imageName, containerfileDir),
          );
        } else {
          yield* d.spinner(
            `Building ${providerLabel} image '${imageName}'...`,
            buildImage(imageName, containerfileDir),
          );
        }
        yield* d.status("Init complete! Image built successfully.", "success");
      } else {
        yield* d.status(
          `Init complete! Run \`sandcastle ${selectedSandboxProvider.cliNamespace} build-image\` to build the ${providerLabel} image later.`,
          "success",
        );
      }

      // Show template-specific next steps
      const nextSteps = getNextStepsLines(
        selectedTemplate,
        scaffoldResult.mainFilename,
        selectedAgent,
      );
      for (const [i, line] of nextSteps.entries()) {
        yield* d.text(i === 0 ? line : styleText("dim", line));
      }
    }),
);

// --- AFK command ---

const afkPromptOption = Options.text("prompt").pipe(
  Options.withDescription(
    "Inline prompt to write to .sandcastle/prompt.md before running",
  ),
  Options.optional,
);

const afkPromptFileOption = Options.file("prompt-file").pipe(
  Options.withDescription(
    "Prompt file to run. Defaults to .sandcastle/prompt.md",
  ),
  Options.optional,
);

const afkBranchOption = Options.text("branch").pipe(
  Options.withDescription(
    "Review branch for the AFK run. Defaults to codex/<name-or-afk-task>",
  ),
  Options.optional,
);

const afkNameOption = Options.text("name").pipe(
  Options.withDescription("Run name used for logs and default branch slug"),
  Options.optional,
);

const afkMaxIterationsOption = Options.text("max-iterations").pipe(
  Options.withDescription("Maximum agent iterations. Default: 8"),
  Options.optional,
);

const afkWorktreeRootOption = Options.text("worktree-root").pipe(
  Options.withDescription(
    "Optional host directory for Sandcastle worktrees, useful for short Windows paths",
  ),
  Options.optional,
);

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "afk-task";
};

const parseMaxIterations = (value: string | undefined): number => {
  if (value === undefined) return 8;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new InitError({
      message: `--max-iterations must be a positive integer, got "${value}"`,
    });
  }
  return parsed;
};

const piAuthMount = [
  { hostPath: "~/.pi/agent", sandboxPath: "/home/agent/.pi/agent" },
] as const;

const afkCommand = Command.make(
  "afk",
  {
    prompt: afkPromptOption,
    promptFile: afkPromptFileOption,
    branch: afkBranchOption,
    name: afkNameOption,
    model: initModelOption,
    maxIterations: afkMaxIterationsOption,
    sandboxProvider: sandboxProviderOption,
    imageName: imageNameOption,
    buildImageNow: buildImageNowOption,
    runNow: runNowOption,
    worktreeRoot: afkWorktreeRootOption,
  },
  ({
    prompt,
    promptFile,
    branch,
    name,
    model,
    maxIterations,
    sandboxProvider: sandboxProviderFlag,
    imageName: imageNameFlag,
    buildImageNow,
    runNow,
    worktreeRoot,
  }) =>
    Effect.gen(function* () {
      const d = yield* Display;
      const cwd = process.cwd();
      const selectedAgent = getAgent("pi-codex")!;
      const selectedBacklogManager = getBacklogManager("beads")!;
      const selectedSandboxProvider =
        sandboxProviderFlag._tag === "Some"
          ? getSandboxProvider(sandboxProviderFlag.value)
          : getSandboxProvider("docker");

      if (!selectedSandboxProvider) {
        const names = listSandboxProviders()
          .map((p) => p.name)
          .join(", ");
        yield* Effect.fail(
          new InitError({
            message: `Unknown sandbox provider "${sandboxProviderFlag._tag === "Some" ? sandboxProviderFlag.value : ""}". Available: ${names}`,
          }),
        );
      }

      const selectedModel =
        model._tag === "Some" ? model.value : selectedAgent.defaultModel;
      const selectedName = name._tag === "Some" ? name.value : "afk-task";
      const selectedBranch =
        branch._tag === "Some"
          ? branch.value
          : `codex/${slugify(selectedName)}`;
      const selectedMaxIterations = parseMaxIterations(
        maxIterations._tag === "Some" ? maxIterations.value : undefined,
      );
      const imageName = resolveImageName(imageNameFlag, cwd);
      const hasConfig = existsSync(join(cwd, CONFIG_DIR));
      if (!hasConfig) {
        yield* d.spinner(
          "Scaffolding Pi/Codex AFK config...",
          scaffold(cwd, {
            agent: selectedAgent,
            model: selectedModel,
            templateName: "blank",
            createLabel: false,
            backlogManager: selectedBacklogManager,
            sandboxProvider: selectedSandboxProvider!,
          }).pipe(
            Effect.mapError(
              (e) =>
                new InitError({
                  message: `${e instanceof Error ? e.message : e}`,
                }),
            ),
          ),
        );
      }

      const promptPath =
        promptFile._tag === "Some"
          ? promptFile.value
          : join(cwd, CONFIG_DIR, "prompt.md");

      if (prompt._tag === "Some") {
        yield* Effect.tryPromise({
          try: () => writeFile(promptPath, prompt.value),
          catch: (e) =>
            new InitError({
              message: `Failed to write prompt file ${promptPath}: ${e instanceof Error ? e.message : String(e)}`,
            }),
        });
      }

      if (!existsSync(promptPath)) {
        yield* Effect.fail(
          new InitError({
            message: `Prompt file not found: ${promptPath}. Pass --prompt or --prompt-file.`,
          }),
        );
      }

      const shouldBuild =
        buildImageNow._tag === "Some" ? buildImageNow.value : true;
      if (shouldBuild) {
        const containerfileDir = join(cwd, CONFIG_DIR);
        if (selectedSandboxProvider!.name === "podman") {
          yield* d.spinner(
            `Building Podman image '${imageName}'...`,
            podmanBuildImage(imageName, containerfileDir),
          );
        } else {
          yield* d.spinner(
            `Building Docker image '${imageName}'...`,
            buildImage(imageName, containerfileDir),
          );
        }
      }

      const shouldRun = runNow._tag === "Some" ? runNow.value : true;
      if (!shouldRun) {
        yield* d.status("AFK config prepared.", "success");
        yield* d.text(
          styleText(
            "dim",
            `Run when ready: sandcastle afk --prompt-file ${promptPath} --branch ${selectedBranch} --no-build-image`,
          ),
        );
        return;
      }

      const sandbox =
        selectedSandboxProvider!.name === "podman"
          ? podman({ imageName, mounts: piAuthMount })
          : docker({ imageName, mounts: piAuthMount });

      const result = yield* Effect.tryPromise({
        try: () =>
          runSandcastle({
            agent: pi(selectedModel),
            sandbox,
            promptFile: promptPath,
            name: selectedName,
            maxIterations: selectedMaxIterations,
            branchStrategy: { type: "branch", branch: selectedBranch },
            worktreeRoot:
              worktreeRoot._tag === "Some" ? worktreeRoot.value : undefined,
          }),
        catch: (e) =>
          new InitError({
            message: e instanceof Error ? e.message : String(e),
          }),
      });

      yield* d.status(
        `AFK run finished on ${result.branch} with ${result.commits.length} commit(s).`,
        "success",
      );
      if (result.logFilePath) {
        yield* d.text(styleText("dim", `Log: ${result.logFilePath}`));
      }
    }),
);

// --- Build-image command ---

const dockerfileOption = Options.file("dockerfile").pipe(
  Options.withDescription(
    "Path to a custom Dockerfile (build context will be the current working directory)",
  ),
  Options.optional,
);

const buildImageCommand = Command.make(
  "build-image",
  {
    imageName: imageNameOption,
    dockerfile: dockerfileOption,
  },
  ({ imageName: imageNameFlag, dockerfile }) =>
    Effect.gen(function* () {
      const d = yield* Display;
      const cwd = process.cwd();
      yield* requireConfigDir(cwd);

      const imageName = resolveImageName(imageNameFlag, cwd);

      const dockerfileDir = join(cwd, CONFIG_DIR);
      const dockerfilePath =
        dockerfile._tag === "Some" ? dockerfile.value : undefined;
      yield* d.spinner(
        `Building Docker image '${imageName}'...`,
        buildImage(imageName, dockerfileDir, {
          dockerfile: dockerfilePath,
        }),
      );

      yield* d.status("Build complete!", "success");
    }),
);

// --- Remove-image command ---

const removeImageCommand = Command.make(
  "remove-image",
  {
    imageName: imageNameOption,
  },
  ({ imageName: imageNameFlag }) =>
    Effect.gen(function* () {
      const d = yield* Display;
      const cwd = process.cwd();

      const imageName = resolveImageName(imageNameFlag, cwd);

      yield* d.spinner(
        `Removing Docker image '${imageName}'...`,
        removeImage(imageName),
      );
      yield* d.status("Image removed.", "success");
    }),
);

// --- Docker namespace command ---

const dockerCommand = Command.make("docker", {}, () =>
  Effect.gen(function* () {
    const d = yield* Display;
    yield* d.status(
      "Docker sandbox commands. Use --help to see available subcommands.",
      "info",
    );
  }),
).pipe(Command.withSubcommands([buildImageCommand, removeImageCommand]));

// --- Podman build-image command ---

const containerfileOption = Options.file("containerfile").pipe(
  Options.withDescription(
    "Path to a custom Containerfile (build context will be the current working directory)",
  ),
  Options.optional,
);

const podmanBuildImageCommand = Command.make(
  "build-image",
  {
    imageName: imageNameOption,
    containerfile: containerfileOption,
  },
  ({ imageName: imageNameFlag, containerfile }) =>
    Effect.gen(function* () {
      const d = yield* Display;
      const cwd = process.cwd();
      yield* requireConfigDir(cwd);

      const imageName = resolveImageName(imageNameFlag, cwd);

      const containerfileDir = join(cwd, CONFIG_DIR);
      const containerfilePath =
        containerfile._tag === "Some" ? containerfile.value : undefined;
      yield* d.spinner(
        `Building Podman image '${imageName}'...`,
        podmanBuildImage(imageName, containerfileDir, {
          containerfile: containerfilePath,
        }),
      );

      yield* d.status("Build complete!", "success");
    }),
);

// --- Podman remove-image command ---

const podmanRemoveImageCommand = Command.make(
  "remove-image",
  {
    imageName: imageNameOption,
  },
  ({ imageName: imageNameFlag }) =>
    Effect.gen(function* () {
      const d = yield* Display;
      const cwd = process.cwd();

      const imageName = resolveImageName(imageNameFlag, cwd);

      yield* d.spinner(
        `Removing Podman image '${imageName}'...`,
        podmanRemoveImage(imageName),
      );
      yield* d.status("Image removed.", "success");
    }),
);

// --- Podman namespace command ---

const podmanCommand = Command.make("podman", {}, () =>
  Effect.gen(function* () {
    const d = yield* Display;
    yield* d.status(
      "Podman sandbox commands. Use --help to see available subcommands.",
      "info",
    );
  }),
).pipe(
  Command.withSubcommands([podmanBuildImageCommand, podmanRemoveImageCommand]),
);

// --- Root command ---

const rootCommand = Command.make("sandcastle", {}, () =>
  Effect.gen(function* () {
    const d = yield* Display;
    yield* d.status(`Sandcastle v${VERSION}`, "info");
    yield* d.status("Use --help to see available commands.", "info");
  }),
);

export const sandcastle = rootCommand.pipe(
  Command.withSubcommands([
    initCommand,
    afkCommand,
    dockerCommand,
    podmanCommand,
  ]),
);

export const cli = Command.run(sandcastle, {
  name: "sandcastle",
  version: VERSION,
});
