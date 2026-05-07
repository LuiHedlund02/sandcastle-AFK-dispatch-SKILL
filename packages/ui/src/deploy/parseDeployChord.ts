/**
 * Multi-target deploy chord parser.
 *
 * Grammar (rule-based, inline — NOT LLM):
 *
 *   deploy [<operative-id>] to <target>[, <target>]* :: <directive>
 *   deploy to <target>[, <target>]* :: <directive>     // operative defaults to "current focus"
 *   <directive>                                         // single-target; current planet, default operative
 *
 * Where `<target>` is matched (case-insensitive) against `Planet.repoName`
 * first, then `Planet.id`. Substring match is sufficient.
 *
 * Always succeeds — never throws. If the input does not start with `deploy`
 * the entire string is treated as a directive (single-target / current planet
 * mode), which preserves Phase 0 behavior.
 */
export interface ParsedDeployTarget {
  readonly id: string;
  readonly repoName: string;
  /** The substring the user typed that matched this planet. */
  readonly matched: string;
}

export interface ParsedDeploy {
  /**
   * The operative codename / id explicitly typed by the user, or `undefined`
   * if not provided (caller substitutes the current operative).
   */
  readonly operativeId?: string;
  readonly targets: readonly ParsedDeployTarget[];
  readonly directive: string;
  /** Substrings the user typed in the target list that didn't match any planet. */
  readonly unknownTargets: readonly string[];
  /** True when the user used the explicit `deploy ... :: ...` form. */
  readonly multiTargetForm: boolean;
}

export interface PlanetForParser {
  readonly id: string;
  readonly repoName: string;
}

const DEPLOY_PREFIX = /^deploy\b/i;
const DIRECTIVE_SEP = "::";

/**
 * Parse a deploy chord input.
 *
 * @param input — raw text from the directive textarea.
 * @param planets — known planets the renderer can target.
 */
export function parseDeployChord(
  input: string,
  planets: readonly PlanetForParser[],
): ParsedDeploy {
  const raw = input ?? "";
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return {
      operativeId: undefined,
      targets: [],
      directive: "",
      unknownTargets: [],
      multiTargetForm: false,
    };
  }

  if (!DEPLOY_PREFIX.test(trimmed)) {
    // Single-target / directive-only form. No targets parsed; caller
    // substitutes the current planet.
    return {
      operativeId: undefined,
      targets: [],
      directive: trimmed,
      unknownTargets: [],
      multiTargetForm: false,
    };
  }

  // Strip leading "deploy" keyword.
  const afterDeploy = trimmed.replace(DEPLOY_PREFIX, "").trim();

  // Find directive separator. If absent the whole thing after `deploy` is
  // treated as the routing slug with an empty directive — submit will be
  // gated.
  const sepIdx = afterDeploy.indexOf(DIRECTIVE_SEP);
  const routePart =
    sepIdx === -1 ? afterDeploy : afterDeploy.slice(0, sepIdx).trim();
  const directive =
    sepIdx === -1
      ? ""
      : afterDeploy.slice(sepIdx + DIRECTIVE_SEP.length).trim();

  // Split the route at the first " to " (case-insensitive). Anything before
  // is the operative id; everything after is the comma-separated target
  // list.
  const toMatch = routePart.match(/\bto\b/i);
  let operativeId: string | undefined;
  let targetSegment: string;
  if (!toMatch || toMatch.index === undefined) {
    targetSegment = routePart;
  } else {
    const beforeTo = routePart.slice(0, toMatch.index).trim();
    targetSegment = routePart.slice(toMatch.index + toMatch[0].length).trim();
    if (beforeTo.length > 0) operativeId = beforeTo;
  }

  const rawTargets = targetSegment
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const targets: ParsedDeployTarget[] = [];
  const unknownTargets: string[] = [];
  const seen = new Set<string>();

  for (const segment of rawTargets) {
    const planet = matchPlanet(segment, planets);
    if (planet) {
      if (seen.has(planet.id)) continue;
      seen.add(planet.id);
      targets.push({
        id: planet.id,
        repoName: planet.repoName,
        matched: segment,
      });
    } else {
      unknownTargets.push(segment);
    }
  }

  return {
    operativeId,
    targets,
    directive,
    unknownTargets,
    multiTargetForm: true,
  };
}

const matchPlanet = (
  needle: string,
  planets: readonly PlanetForParser[],
): PlanetForParser | undefined => {
  const lc = needle.toLowerCase();
  // Phase 1: exact (case-insensitive) match against repoName, then id.
  for (const p of planets) {
    if (p.repoName.toLowerCase() === lc) return p;
  }
  for (const p of planets) {
    if (p.id.toLowerCase() === lc) return p;
  }
  // Phase 2: substring match on repoName, then id.
  for (const p of planets) {
    if (p.repoName.toLowerCase().includes(lc)) return p;
  }
  for (const p of planets) {
    if (p.id.toLowerCase().includes(lc)) return p;
  }
  return undefined;
};
