import type { CSSProperties, JSX, MouseEvent } from "react";
import { useMemo } from "react";
import type { Planet } from "@sandcastle/protocol";
import styles from "./GalaxySvgRenderer.module.css";
import { planetClimate, type PlanetClimate } from "./climate";

export interface GalaxyTransitOperative {
  readonly id: string;
  readonly toPlanetId: string;
  readonly label?: string;
}

export interface GalaxySvgRendererProps {
  readonly planets: readonly Planet[];
  /** Highlighted planet id — drawn larger with a magenta selection ring. */
  readonly currentPlanetId?: string;
  readonly onSelectPlanet?: (
    planet: Planet,
    event: MouseEvent<SVGGElement>,
  ) => void;
  /** Optional list of operatives currently in transit. Rendered as small sprites
   *  travelling along the path from the sun to their target planet. */
  readonly transits?: readonly GalaxyTransitOperative[];
  readonly className?: string;
  readonly width?: number;
  readonly height?: number;
}

const VIEW = { w: 1100, h: 700 } as const;
const CENTER = { x: VIEW.w / 2, y: VIEW.h / 2 } as const;
const SUN_R = 30;

/**
 * Concentric-orbit galaxy.
 *
 * Layout:
 *   - Sun in the centre with a slow pulsing glow.
 *   - 4 orbital rings at radii [120, 200, 280, 340] (px in viewBox).
 *   - Planets distributed across rings; each ring rotates at its own
 *     period, alternating direction. Planet bodies counter-rotate so
 *     labels stay upright.
 *   - Climate skins (clear/warm/storm/live/idle) drive the body fill via
 *     SVG radial gradients keyed by `--climate-*`.
 *   - Selected planet gets a dashed magenta ring + scale 1.15.
 *   - Optional transit operatives ride a path from the sun to a target
 *     planet's anchor point.
 *
 * All animations honour `prefers-reduced-motion: reduce` (CSS module).
 *
 * Backwards-compat: the `planets / currentPlanetId / onSelectPlanet`
 * triplet matches the prior thin primitive — older callers keep working.
 */
export function GalaxySvgRenderer({
  planets,
  currentPlanetId,
  onSelectPlanet,
  transits,
  className,
  width,
  height,
}: GalaxySvgRendererProps): JSX.Element {
  const layout = useMemo(() => buildLayout(planets), [planets]);

  const cls = [styles.root, className].filter(Boolean).join(" ");

  const transitPaths = useMemo(() => {
    if (!transits || transits.length === 0) return [];
    const byPlanet = new Map(layout.placements.map((p) => [p.planet.id, p]));
    return transits.flatMap((t) => {
      const target = byPlanet.get(t.toPlanetId);
      if (!target) return [];
      return [{ transit: t, target }];
    });
  }, [transits, layout]);

  return (
    <div
      className={cls}
      style={width || height ? { width, height } : undefined}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        role="group"
        aria-label={`Galaxy of ${planets.length} planet${planets.length === 1 ? "" : "s"}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {CLIMATE_KEYS.map((c) => (
            <ClimateGradients key={c} climate={c} />
          ))}
          <radialGradient id="sc-galaxy-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7d4" />
            <stop offset="40%" stopColor="#ffb547" />
            <stop offset="80%" stopColor="#a85a18" />
            <stop offset="100%" stopColor="rgba(168,90,24,0)" />
          </radialGradient>
          <radialGradient id="sc-galaxy-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,181,71,0.45)" />
            <stop offset="60%" stopColor="rgba(255,181,71,0.12)" />
            <stop offset="100%" stopColor="rgba(255,181,71,0)" />
          </radialGradient>
        </defs>

        {/* faint background field */}
        <rect
          x={0}
          y={0}
          width={VIEW.w}
          height={VIEW.h}
          fill="rgba(86,212,224,0.025)"
        />

        {/* orbital rings (static guides) */}
        {layout.rings.map((ring) => (
          <circle
            key={`guide-${ring.r}`}
            cx={CENTER.x}
            cy={CENTER.y}
            r={ring.r}
            fill="none"
            stroke="rgba(120,200,220,0.10)"
            strokeWidth={1}
            strokeDasharray="2 6"
          />
        ))}

        {/* sun glow + body */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={SUN_R * 4}
          fill="url(#sc-galaxy-glow)"
        />
        <g
          className={styles.sun}
          style={
            { transformOrigin: `${CENTER.x}px ${CENTER.y}px` } as CSSProperties
          }
        >
          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r={SUN_R}
            fill="url(#sc-galaxy-sun)"
          />
        </g>

        {/* sun label */}
        <text
          x={CENTER.x}
          y={CENTER.y + SUN_R + 20}
          textAnchor="middle"
          fill="var(--sc-amber)"
          fontFamily="var(--sc-mono)"
          fontSize={11}
          letterSpacing="2"
          style={{
            textTransform: "uppercase",
            textShadow: "0 0 6px rgba(255,181,71,0.5)",
          }}
        >
          SOL · ANCHOR
        </text>

        {/* planets, grouped by ring so each ring spins as one body */}
        {layout.rings.map((ring, ringIdx) => (
          <g
            key={`ring-${ring.r}`}
            className={styles.ring}
            style={
              {
                transformOrigin: `${CENTER.x}px ${CENTER.y}px`,
                "--ring-period": `${ring.period}s`,
                "--ring-dir": ringIdx % 2 === 0 ? "normal" : "reverse",
                "--ring-counter-dir": ringIdx % 2 === 0 ? "reverse" : "normal",
              } as CSSProperties
            }
          >
            {ring.planets.map((p) => (
              <PlanetNode
                key={p.planet.id}
                place={p}
                ringPeriod={ring.period}
                ringDir={ringIdx % 2 === 0 ? "normal" : "reverse"}
                isSelected={p.planet.id === currentPlanetId}
                onSelect={onSelectPlanet}
              />
            ))}
          </g>
        ))}

        {/* transit operatives */}
        {transitPaths.map(({ transit, target }) => {
          const dx = target.cx - CENTER.x;
          const dy = target.cy - CENTER.y;
          return (
            <g
              key={`transit-${transit.id}`}
              className={styles.transitSpark}
              style={
                {
                  transformOrigin: `${CENTER.x}px ${CENTER.y}px`,
                } as CSSProperties
              }
            >
              <line
                x1={CENTER.x}
                y1={CENTER.y}
                x2={target.cx}
                y2={target.cy}
                stroke="rgba(255,181,71,0.35)"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
              <g
                transform={`translate(${CENTER.x + dx * 0.62},${
                  CENTER.y + dy * 0.62
                }) rotate(45)`}
              >
                <rect
                  x={-5}
                  y={-5}
                  width={10}
                  height={10}
                  fill="var(--sc-amber)"
                  style={{
                    filter:
                      "drop-shadow(0 0 8px rgba(255,181,71,0.8)) drop-shadow(0 0 16px rgba(255,181,71,0.5))",
                  }}
                />
              </g>
              {transit.label ? (
                <text
                  x={CENTER.x + dx * 0.62}
                  y={CENTER.y + dy * 0.62 + 22}
                  textAnchor="middle"
                  fill="var(--sc-amber)"
                  fontFamily="var(--sc-mono)"
                  fontSize={10}
                  letterSpacing="1"
                  style={{ textShadow: "0 0 4px rgba(255,181,71,0.6)" }}
                >
                  {transit.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── layout ───────────────────────────────────────────────────────────────

interface PlanetPlacement {
  readonly planet: Planet;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly climate: PlanetClimate;
  readonly angleRad: number;
  readonly orbitRadius: number;
}

interface RingDescriptor {
  readonly r: number;
  readonly period: number;
  readonly planets: PlanetPlacement[];
}

interface GalaxyLayout {
  readonly rings: readonly RingDescriptor[];
  readonly placements: readonly PlanetPlacement[];
}

// 4 concentric rings, slightly different periods → parallax effect.
// Periods are in seconds; the mockup brief asks for 0.5–2.0 minutes per
// revolution.
const RING_DEFS: ReadonlyArray<{ r: number; period: number }> = [
  { r: 110, period: 38 }, // inner: 38s ≈ 0.6 min
  { r: 188, period: 62 },
  { r: 264, period: 92 },
  { r: 332, period: 122 }, // outer: 122s ≈ 2.0 min
];

function buildLayout(planets: readonly Planet[]): GalaxyLayout {
  if (planets.length === 0) {
    return {
      rings: RING_DEFS.map((d) => ({ ...d, planets: [] })),
      placements: [],
    };
  }

  // Distribute planets across rings (round-robin, but bias bigger
  // terraform stages outward — those are usually the user's anchor /
  // marquee planets and read better on the long curves).
  const sorted = [...planets].sort(
    (a, b) =>
      (b.terraformStage ?? 0) - (a.terraformStage ?? 0) ||
      a.repoName.localeCompare(b.repoName),
  );

  const ringPlanets: PlanetPlacement[][] = RING_DEFS.map(() => []);
  sorted.forEach((planet, i) => {
    const ringIndex = i % RING_DEFS.length;
    ringPlanets[ringIndex]!.push(toPlacement(planet, ringIndex, 0));
  });

  // After bucketing, distribute angles evenly within each ring and stamp
  // a stable angle for label/transit alignment.
  const rings: RingDescriptor[] = RING_DEFS.map((def, idx) => {
    const bucket = ringPlanets[idx]!;
    const n = bucket.length;
    const placements = bucket.map((p, j) => {
      // Stagger every other ring by half-step so neighbours don't line
      // up radially.
      const offset = idx % 2 === 0 ? 0 : Math.PI / Math.max(1, n);
      const angle = (j / Math.max(1, n)) * Math.PI * 2 + offset;
      const cx = CENTER.x + Math.cos(angle) * def.r;
      const cy = CENTER.y + Math.sin(angle) * def.r;
      const climate = planetClimate(p.planet);
      const r = bodyRadius(p.planet);
      return {
        planet: p.planet,
        cx,
        cy,
        r,
        climate,
        angleRad: angle,
        orbitRadius: def.r,
      } satisfies PlanetPlacement;
    });
    return { ...def, planets: placements };
  });

  return {
    rings,
    placements: rings.flatMap((r) => r.planets),
  };
}

function toPlacement(
  planet: Planet,
  _ringIdx: number,
  _slot: number,
): PlanetPlacement {
  // Filled in by buildLayout; this stub keeps types narrow before the
  // angle pass.
  return {
    planet,
    cx: 0,
    cy: 0,
    r: bodyRadius(planet),
    climate: planetClimate(planet),
    angleRad: 0,
    orbitRadius: 0,
  };
}

function bodyRadius(planet: Planet): number {
  // Bigger = more cards on the deck. Bound so the largest planet doesn't
  // collide with neighbouring rings.
  const cards = 1 + planet.deck.skills.length + planet.deck.commands.length;
  return Math.max(18, Math.min(34, 16 + cards * 2));
}

// ─── nodes ────────────────────────────────────────────────────────────────

function PlanetNode({
  place,
  ringPeriod,
  ringDir,
  isSelected,
  onSelect,
}: {
  readonly place: PlanetPlacement;
  readonly ringPeriod: number;
  readonly ringDir: "normal" | "reverse";
  readonly isSelected: boolean;
  readonly onSelect?: (planet: Planet, event: MouseEvent<SVGGElement>) => void;
}): JSX.Element {
  const { cx, cy, r, climate, planet } = place;
  const scale = isSelected ? 1.15 : 1;

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`Planet ${planet.repoName}, climate ${climate}`}
      className={styles.planetButton}
      onClick={(event) => onSelect?.(planet, event)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(planet, event as unknown as MouseEvent<SVGGElement>);
        }
      }}
      style={{
        cursor: onSelect ? "pointer" : "default",
      }}
      transform={`translate(${cx} ${cy}) scale(${scale})`}
    >
      {/* Keyboard focus ring — hidden by default, shown on :focus-visible
       *  via the CSS module. Drawn first so the planet body sits on top
       *  with the ring extending past it as a halo. */}
      <circle
        cx={0}
        cy={0}
        r={r + 8}
        className={styles.focusRing}
        fill="none"
        stroke="var(--sc-cyan)"
        strokeWidth={2}
      />
      {/* Counter-rotate the body so the body's own gradient highlights
       *  don't appear to spin opposite to the ring (and labels stay
       *  upright). */}
      <g
        className={
          climate === "storm"
            ? `${styles.bodyCounter} ${styles.stormBody}`
            : styles.bodyCounter
        }
        style={
          {
            "--ring-period": `${ringPeriod}s`,
            "--ring-counter-dir": ringDir === "normal" ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        {/* outer halo */}
        <circle
          cx={0}
          cy={0}
          r={r + 6}
          fill={`url(#sc-galaxy-halo-${climate})`}
        />
        {/* body */}
        <circle
          cx={0}
          cy={0}
          r={r}
          fill={`url(#sc-galaxy-body-${climate})`}
          stroke={haloStroke(climate)}
          strokeWidth={1}
          opacity={climate === "idle" ? 0.7 : 1}
        />
        {/* live spark */}
        {climate === "live" ? (
          <rect
            x={r * 0.35}
            y={-r * 0.55}
            width={6}
            height={6}
            transform="rotate(45)"
            fill="var(--sc-magenta)"
            style={{
              filter:
                "drop-shadow(0 0 6px var(--sc-magenta)) drop-shadow(0 0 12px rgba(255,46,136,0.6))",
            }}
          />
        ) : null}
      </g>

      {/* selection ring */}
      {isSelected ? (
        <g
          className={styles.selectedRing}
          style={{ transformOrigin: "0px 0px" } as CSSProperties}
        >
          <circle
            cx={0}
            cy={0}
            r={r + 12}
            fill="none"
            stroke="var(--sc-magenta)"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.8}
          />
        </g>
      ) : null}

      {/* label (counter-translated by the parent ring's spin already on
       *  the parent <g>; we don't need extra counter-rotate here) */}
      <text
        x={0}
        y={r + 18}
        textAnchor="middle"
        fill="var(--sc-frost)"
        fontFamily="var(--sc-display)"
        fontSize={11}
        letterSpacing="1.5"
        style={{
          textTransform: "uppercase",
          textShadow: "-0.5px 0 var(--sc-magenta), 0.5px 0 var(--sc-cyan)",
          pointerEvents: "none",
        }}
      >
        {planet.repoName}
      </text>
      <text
        x={0}
        y={r + 32}
        textAnchor="middle"
        fill={climateLabelColor(climate)}
        fontFamily="var(--sc-mono)"
        fontSize={9}
        letterSpacing="1"
        style={{ pointerEvents: "none" }}
      >
        {climate.toUpperCase()}
      </text>
    </g>
  );
}

// ─── climate skins ────────────────────────────────────────────────────────

const CLIMATE_KEYS: readonly PlanetClimate[] = [
  "clear",
  "warm",
  "storm",
  "live",
  "idle",
];

function ClimateGradients({
  climate,
}: {
  readonly climate: PlanetClimate;
}): JSX.Element {
  const stops = CLIMATE_BODY_STOPS[climate];
  const halo = CLIMATE_HALO_STOPS[climate];
  return (
    <>
      <radialGradient
        id={`sc-galaxy-body-${climate}`}
        cx="32%"
        cy="28%"
        r="80%"
      >
        {stops.map((s, i) => (
          <stop key={i} offset={s.offset} stopColor={s.color} />
        ))}
      </radialGradient>
      <radialGradient
        id={`sc-galaxy-halo-${climate}`}
        cx="50%"
        cy="50%"
        r="50%"
      >
        {halo.map((s, i) => (
          <stop key={i} offset={s.offset} stopColor={s.color} />
        ))}
      </radialGradient>
    </>
  );
}

const CLIMATE_BODY_STOPS: Record<
  PlanetClimate,
  ReadonlyArray<{ offset: string; color: string }>
> = {
  clear: [
    { offset: "0%", color: "#1d3d4a" },
    { offset: "40%", color: "#0a1f28" },
    { offset: "75%", color: "#03070a" },
    { offset: "100%", color: "#020306" },
  ],
  warm: [
    { offset: "0%", color: "#3d2f18" },
    { offset: "40%", color: "#241a0c" },
    { offset: "75%", color: "#06030a" },
    { offset: "100%", color: "#020204" },
  ],
  storm: [
    { offset: "0%", color: "#3a1419" },
    { offset: "40%", color: "#240a10" },
    { offset: "75%", color: "#06030a" },
    { offset: "100%", color: "#020204" },
  ],
  live: [
    { offset: "0%", color: "#15333d" },
    { offset: "40%", color: "#0a1f28" },
    { offset: "75%", color: "#03070a" },
    { offset: "100%", color: "#020306" },
  ],
  idle: [
    { offset: "0%", color: "#202830" },
    { offset: "40%", color: "#0e1218" },
    { offset: "75%", color: "#03060a" },
    { offset: "100%", color: "#020203" },
  ],
};

const CLIMATE_HALO_STOPS: Record<
  PlanetClimate,
  ReadonlyArray<{ offset: string; color: string }>
> = {
  clear: [
    { offset: "0%", color: "rgba(86,212,224,0.0)" },
    { offset: "65%", color: "rgba(86,212,224,0.0)" },
    { offset: "100%", color: "rgba(86,212,224,0.18)" },
  ],
  warm: [
    { offset: "0%", color: "rgba(255,181,71,0.0)" },
    { offset: "65%", color: "rgba(255,181,71,0.0)" },
    { offset: "100%", color: "rgba(255,181,71,0.20)" },
  ],
  storm: [
    { offset: "0%", color: "rgba(255,94,108,0.0)" },
    { offset: "60%", color: "rgba(255,94,108,0.0)" },
    { offset: "100%", color: "rgba(255,94,108,0.30)" },
  ],
  live: [
    { offset: "0%", color: "rgba(108,255,170,0.0)" },
    { offset: "55%", color: "rgba(108,255,170,0.0)" },
    { offset: "100%", color: "rgba(108,255,170,0.32)" },
  ],
  idle: [
    { offset: "0%", color: "rgba(120,140,160,0.0)" },
    { offset: "100%", color: "rgba(120,140,160,0.10)" },
  ],
};

function haloStroke(climate: PlanetClimate): string {
  switch (climate) {
    case "clear":
      return "rgba(86,212,224,0.45)";
    case "warm":
      return "rgba(255,181,71,0.45)";
    case "storm":
      return "rgba(255,94,108,0.55)";
    case "live":
      return "rgba(108,255,170,0.55)";
    case "idle":
      return "rgba(120,140,160,0.30)";
  }
}

function climateLabelColor(climate: PlanetClimate): string {
  switch (climate) {
    case "clear":
      return "var(--sc-cyan)";
    case "warm":
      return "var(--sc-amber)";
    case "storm":
      return "var(--sc-crimson)";
    case "live":
      return "var(--sc-plasma)";
    case "idle":
      return "var(--sc-steel)";
  }
}
