import type {
  CommandCard,
  OperativeIdentity,
  SkillCard,
} from "@sandcastle/protocol";

export const enabledSkills = (
  skills: readonly SkillCard[],
): readonly SkillCard[] =>
  skills.filter((skill) => skill.enabled).sort(bySlugThenTitle);

export const enabledCommands = (
  commands: readonly CommandCard[],
): readonly CommandCard[] =>
  commands.filter((command) => command.enabled).sort(bySlugThenTitle);

export const fileSlug = (slug: string): string =>
  slug
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "card";

export const operativeContext = (operative: OperativeIdentity): string =>
  [
    `Operative: ${operative.className} ${operative.codename}`,
    `Provider: ${operative.provider}`,
    `Model: ${operative.model}`,
  ].join("\n");

export const section = (title: string, body: string): string =>
  [`## ${title}`, "", body.trim()].join("\n");

export const yamlString = (value: string): string =>
  JSON.stringify(value).replace(/^-/, '"-"');

const bySlugThenTitle = <T extends { slug: string; title: string }>(
  a: T,
  b: T,
): number => a.slug.localeCompare(b.slug) || a.title.localeCompare(b.title);
