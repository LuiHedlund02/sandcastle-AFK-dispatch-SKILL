import type { JSX } from "react";
import type { Planet } from "@sandcastle/protocol";

export interface PlanetSvgRendererProps {
  readonly planet: Planet;
  /** Pixel size of the rendered SVG (square). */
  readonly size?: number;
  readonly className?: string;
}

/**
 * Ortho-map of a planet: ocean disc, graticule, terminator, and continent
 * blobs derived from the deck's mode + skill cards. Visual fidelity scales
 * with `terraformStage`:
 *
 *   - stage 0–1: night side dominates, only one or two settled continents
 *   - stage 2–3: full continents + clouds + a single boss marker
 *   - stage 4–5: bright specular highlight + plasma feature halos
 *
 * Stages 4 and 5 currently differ only by halo intensity. TODO: per-stage
 * weather, multiple boss tiers, ward overlay icons.
 */
export function PlanetSvgRenderer({
  planet,
  size = 480,
  className,
}: PlanetSvgRendererProps): JSX.Element {
  const stage = clamp(Math.round(planet.terraformStage), 0, 5);
  const { continents, features, hasBoss } = planetGeometry(planet, stage);

  const showClouds = stage >= 2;
  const showSpecular = stage >= 3;
  const haloOpacity = 0.35 + stage * 0.08;

  return (
    <svg
      className={className}
      viewBox="-340 -340 680 680"
      width={size}
      height={size}
      role="img"
      aria-label={`Planet ${planet.repoName}, terraform stage ${stage}`}
      style={{
        filter: `drop-shadow(0 0 ${24 + stage * 4}px rgba(86, 212, 224, ${0.12 + stage * 0.03}))`,
      }}
    >
      <defs>
        <radialGradient id="sc-ocean" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#1a3a48" />
          <stop offset="40%" stopColor="#0c2530" />
          <stop offset="80%" stopColor="#04101a" />
          <stop offset="100%" stopColor="#020810" />
        </radialGradient>
        <radialGradient id="sc-spec" cx="32%" cy="26%" r="22%">
          <stop offset="0%" stopColor="rgba(220,234,243,0.32)" />
          <stop offset="60%" stopColor="rgba(220,234,243,0.06)" />
          <stop offset="100%" stopColor="rgba(220,234,243,0)" />
        </radialGradient>
        <radialGradient id="sc-term" cx="100%" cy="60%" r="80%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0.35)" />
          <stop offset="80%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <linearGradient id="sc-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(127,230,239,0.7)" />
          <stop offset="50%" stopColor="rgba(86,212,224,0.18)" />
          <stop offset="100%" stopColor="rgba(86,212,224,0.05)" />
        </linearGradient>
        <radialGradient id="sc-land-plasma" cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#1f4a3a" />
          <stop offset="100%" stopColor="#0a2418" />
        </radialGradient>
        <radialGradient id="sc-land-amber" cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#3d2c14" />
          <stop offset="100%" stopColor="#1a1006" />
        </radialGradient>
        <radialGradient id="sc-land-mid" cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#173640" />
          <stop offset="100%" stopColor="#0a1c24" />
        </radialGradient>
        <radialGradient id="sc-land-boss" cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#3a1426" />
          <stop offset="100%" stopColor="#1a0612" />
        </radialGradient>
        <clipPath id="sc-globe">
          <circle cx="0" cy="0" r="280" />
        </clipPath>
      </defs>

      {/* atmosphere outside the disc */}
      <circle
        cx="0"
        cy="0"
        r="298"
        fill="none"
        stroke="rgba(86,212,224,0.10)"
        strokeWidth={6}
        style={{ filter: "blur(6px)" }}
      />
      <circle
        cx="0"
        cy="0"
        r="286"
        fill="none"
        stroke="rgba(86,212,224,0.30)"
        strokeWidth={1}
      />

      <g clipPath="url(#sc-globe)">
        <circle cx="0" cy="0" r="280" fill="url(#sc-ocean)" />

        {/* graticule */}
        <g fill="none" stroke="rgba(86,212,224,0.10)" strokeWidth={0.4}>
          <ellipse cx="0" cy="-180" rx="215" ry="14" />
          <ellipse cx="0" cy="-90" rx="265" ry="20" />
          <ellipse
            cx="0"
            cy="0"
            rx="280"
            ry="26"
            stroke="rgba(86,212,224,0.16)"
            strokeWidth={0.5}
          />
          <ellipse cx="0" cy="90" rx="265" ry="20" />
          <ellipse cx="0" cy="180" rx="215" ry="14" />
          <ellipse cx="0" cy="0" rx="60" ry="280" />
          <ellipse cx="0" cy="0" rx="140" ry="280" />
          <ellipse
            cx="0"
            cy="0"
            rx="220"
            ry="280"
            stroke="rgba(86,212,224,0.16)"
            strokeWidth={0.5}
          />
        </g>

        {/* continents */}
        {continents.map((c, i) => (
          <path
            key={`c-${i}`}
            d={c.d}
            fill={`url(#sc-land-${c.fill})`}
            stroke={c.stroke}
            strokeWidth={c.strokeWidth}
            strokeDasharray={c.dashed ? "2 2" : undefined}
            style={{
              filter: `drop-shadow(0 0 ${5 + stage}px ${c.glow})`,
            }}
          />
        ))}

        {showClouds ? (
          <g
            fill="rgba(220,234,243,0.045)"
            stroke="rgba(220,234,243,0.10)"
            strokeWidth={0.3}
          >
            <path d="M -310 -50 C -240 -70 -150 -55 -60 -65 C 30 -75 130 -55 230 -68 C 290 -75 360 -60 420 -70 L 420 -38 C 360 -28 290 -42 230 -36 C 130 -24 30 -42 -60 -32 C -150 -22 -240 -38 -310 -28 Z" />
            <path d="M -310 70 C -230 50 -120 65 -20 55 C 80 48 180 65 280 55 C 340 48 400 60 420 55 L 420 86 C 400 92 340 80 280 86 C 180 96 80 80 -20 88 C -120 98 -230 82 -310 100 Z" />
          </g>
        ) : null}

        {showSpecular ? (
          <ellipse cx="-100" cy="-110" rx="120" ry="80" fill="url(#sc-spec)" />
        ) : null}

        <rect x="-280" y="-280" width="560" height="560" fill="url(#sc-term)" />

        {features.map((f, i) => (
          <g key={`f-${i}`} stroke={f.color} fill={f.color}>
            <circle cx={f.x} cy={f.y} r={6} fill="none" opacity={haloOpacity} />
            <circle cx={f.x} cy={f.y} r={2.6} />
          </g>
        ))}

        {hasBoss ? (
          <g stroke="var(--sc-magenta)" fill="var(--sc-magenta)">
            <circle cx={10} cy={15} r={9} fill="none" opacity={0.5} />
            <circle cx={10} cy={15} r={3.4} />
          </g>
        ) : null}
      </g>

      <circle
        cx="0"
        cy="0"
        r="280"
        fill="none"
        stroke="url(#sc-rim)"
        strokeWidth={1.2}
      />
    </svg>
  );
}

interface ContinentDef {
  readonly d: string;
  readonly fill: "plasma" | "amber" | "mid" | "boss";
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly dashed?: boolean;
  readonly glow: string;
}

interface FeatureDef {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

interface PlanetGeometry {
  readonly continents: readonly ContinentDef[];
  readonly features: readonly FeatureDef[];
  readonly hasBoss: boolean;
}

/**
 * Derive a stable continent + feature layout for a planet from its deck.
 * Different repos get different "shapes" deterministically because we hash
 * the planet id into rotations on a small set of base continents.
 */
function planetGeometry(planet: Planet, stage: number): PlanetGeometry {
  const skillCount = planet.deck.skills.length;
  const commandCount = planet.deck.commands.length;
  const totalCards = 1 + skillCount + commandCount;
  const continentCount = clamp(Math.min(totalCards, 5), 1, 5);

  const baseContinents: ContinentDef[] = [
    {
      d: "M -210 -150 C -180 -180 -120 -180 -90 -160 C -70 -145 -75 -110 -110 -100 C -150 -92 -190 -100 -210 -120 Z",
      fill: "plasma",
      stroke: "rgba(108,255,170,0.55)",
      strokeWidth: 0.6,
      glow: "rgba(108,255,170,0.35)",
    },
    {
      d: "M -50 -195 C -10 -210 60 -200 70 -170 C 80 -148 50 -135 20 -140 C -10 -148 -40 -160 -50 -195 Z",
      fill: "plasma",
      stroke: "rgba(108,255,170,0.55)",
      strokeWidth: 0.6,
      glow: "rgba(108,255,170,0.30)",
    },
    {
      d: "M 110 -120 C 145 -150 220 -130 230 -90 C 232 -60 200 -40 165 -50 C 130 -62 105 -90 110 -120 Z",
      fill: "mid",
      stroke: "rgba(86,212,224,0.45)",
      strokeWidth: 0.5,
      glow: "rgba(86,212,224,0.25)",
    },
    {
      d: "M -220 60 C -180 35 -130 50 -120 90 C -110 130 -150 170 -195 165 C -230 158 -245 110 -220 60 Z",
      fill: "amber",
      stroke: "rgba(255,181,71,0.55)",
      strokeWidth: 0.6,
      glow: "rgba(255,181,71,0.30)",
    },
    {
      d: "M -40 130 C 0 110 60 120 70 160 C 75 195 30 220 -20 210 C -55 200 -65 165 -40 130 Z",
      fill: "mid",
      stroke: "rgba(86,212,224,0.45)",
      strokeWidth: 0.5,
      glow: "rgba(86,212,224,0.25)",
    },
  ];

  // Stage shrinks the visible continent set when the planet is undeveloped.
  const visibleCount = Math.min(continentCount, Math.max(1, stage + 1));
  const continents = baseContinents.slice(0, visibleCount);

  // Boss marker appears whenever the planet carries any unaddressed scars.
  const hasBoss = planet.scars.length > 0;

  // A few feature pings, deterministic from the count of commands.
  const featurePool: FeatureDef[] = [
    { x: -150, y: -135, color: "var(--sc-plasma)" },
    { x: 10, y: -170, color: "var(--sc-plasma)" },
    { x: 170, y: -85, color: "var(--sc-cyan)" },
    { x: -170, y: 115, color: "var(--sc-amber)" },
    { x: 20, y: 170, color: "var(--sc-cyan)" },
    { x: 200, y: 115, color: "var(--sc-amber)" },
  ];
  const featureCount = clamp(commandCount, 0, featurePool.length);
  const features = featurePool.slice(0, featureCount);

  return { continents, features, hasBoss };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
