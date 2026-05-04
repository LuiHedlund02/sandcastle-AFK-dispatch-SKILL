import type { Planet } from "@sandcastle/protocol";

export type PlanetClimate = "clear" | "warm" | "storm" | "live" | "idle";

/**
 * Derive a planet's "climate" — the cyberpunk biome skin used by the
 * Galaxy renderer. The dial spins from livest → calmest:
 *
 *   live   — at least one run is in flight (override, beats everything)
 *   storm  — open issues ≥ 5 OR churn score ≥ 0.6 (turbulent code)
 *   clear  — coverage ≥ 70 % AND CI green-rate (when known) ≥ 85 %
 *   idle   — no run, no commits in the last 30 days, or stage ≤ 0
 *   warm   — fallback for anything signal-bearing in between
 *
 * Pure function. Stable for tests and SSR. Telemetry fields are
 * `null`-safe — missing data degrades to `warm` (the neutral skin) so
 * we never punish a fresh repo.
 */
export function planetClimate(planet: Planet): PlanetClimate {
  const t = planet.telemetry;

  if (planet.activeRunIds.length > 0) return "live";

  const churn = t.churnScore ?? 0;
  const open = t.openIssues ?? 0;
  if (open >= 5 || churn >= 0.6) return "storm";

  const coverage = t.coveragePct;
  const ci = t.ciGreenRate30d;
  if (coverage != null && coverage >= 70 && (ci == null || ci >= 85)) {
    return "clear";
  }

  if (planet.terraformStage <= 0) return "idle";
  if (t.lastCommitAt) {
    const ageMs = Date.now() - new Date(t.lastCommitAt).getTime();
    const days = ageMs / 86_400_000;
    if (Number.isFinite(days) && days >= 30) return "idle";
  } else if (t.ageDays != null && t.ageDays >= 30) {
    return "idle";
  }

  return "warm";
}
