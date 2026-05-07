import type {
  AgentProviderAdapter,
  ProviderAdapterInput,
  ProviderAdapterOutput,
} from "./AgentProviderAdapter.js";
import {
  enabledCommands,
  enabledSkills,
  operativeContext,
  section,
} from "./adapterFormatting.js";

export class CodexAdapter implements AgentProviderAdapter {
  readonly id = "codex" as const;

  async materialize(
    input: ProviderAdapterInput,
  ): Promise<ProviderAdapterOutput> {
    const parts = [
      operativeContext(input.operative),
      "",
      section(`Mode: ${input.deck.mode.title}`, input.deck.mode.body),
      ...enabledSkills(input.deck.skills).map((skill) =>
        section(`Skill: ${skill.title}`, skill.body),
      ),
      ...enabledCommands(input.deck.commands).map((command) =>
        section(
          `Command: ${command.slashCommand} ${command.title}`,
          command.body,
        ),
      ),
    ];
    return {
      files: [{ relativePath: "AGENTS.md", content: parts.join("\n\n") }],
      cleanupPaths: ["AGENTS.md"],
    };
  }
}
