import type { CommandCard } from "@sandcastle/protocol";
import type {
  AgentProviderAdapter,
  ProviderAdapterInput,
  ProviderAdapterOutput,
  ProviderMaterializedFile,
} from "./AgentProviderAdapter.js";
import {
  enabledCommands,
  enabledSkills,
  fileSlug,
  operativeContext,
  yamlString,
} from "./adapterFormatting.js";

export class ClaudeCodeAdapter implements AgentProviderAdapter {
  readonly id = "claude-code" as const;

  async materialize(
    input: ProviderAdapterInput,
  ): Promise<ProviderAdapterOutput> {
    const files: ProviderMaterializedFile[] = [
      {
        relativePath: ".claude/agents.md",
        content: [
          operativeContext(input.operative),
          "",
          `# ${input.deck.mode.title}`,
          "",
          input.deck.mode.body.trim(),
        ].join("\n"),
      },
      ...enabledSkills(input.deck.skills).map((skill) => ({
        relativePath: `.claude/skills/${fileSlug(skill.slug)}.md`,
        content: [`# ${skill.title}`, "", skill.body.trim()].join("\n"),
      })),
      ...enabledCommands(input.deck.commands).map((command) => ({
        relativePath: `.claude/commands/${fileSlug(command.slug)}.md`,
        content: commandContent(command),
      })),
    ];
    return { files, cleanupPaths: [".claude/"] };
  }
}

const commandContent = (command: CommandCard): string =>
  [
    "---",
    `description: ${yamlString(command.summary || command.title)}`,
    `argument-hint: ${yamlString(command.slashCommand)}`,
    "---",
    "",
    `# ${command.title}`,
    "",
    command.body.trim(),
  ].join("\n");
