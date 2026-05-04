import type { JSX, MouseEvent } from "react";
import type { Planet } from "@sandcastle/protocol";

export interface GalaxySvgRendererProps {
  readonly planets: readonly Planet[];
  /** Highlighted planet id — drawn larger with a magenta ring. */
  readonly currentPlanetId?: string;
  readonly onSelectPlanet?: (
    planet: Planet,
    event: MouseEvent<SVGGElement>,
  ) => void;
  readonly className?: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Constellation diagram of every registered planet.
 *
 * Layout: a deterministic Fibonacci-spiral packing scaled into the
 * SVG viewBox. Each planet is one node; the brightest connecting
 * lines run from the current planet to its 3 nearest neighbours.
 *
 * Pure render. The screen subagent decides routing on click.
 */
export function GalaxySvgRenderer({
  planets,
  currentPlanetId,
  onSelectPlanet,
  className,
  width = 720,
  height = 480,
}: GalaxySvgRendererProps): JSX.Element {
  const positions = positionPlanets(planets, width, height);
  const current = positions.find((p) => p.planet.id === currentPlanetId);
  const neighbours = current ? nearestNeighbours(current, positions, 3) : [];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Galaxy of ${planets.length} planet${planets.length === 1 ? "" : "s"}`}
    >
      <defs>
        <radialGradient id="sc-galaxy-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(86,212,224,0.10)" />
          <stop offset="100%" stopColor="rgba(3,6,10,0)" />
        </radialGradient>
        <linearGradient id="sc-galaxy-link" x1="0" x2="1">
          <stop offset="0%" stopColor="rgba(86,212,224,0.5)" />
          <stop offset="100%" stopColor="rgba(86,212,224,0.05)" />
        </linearGradient>
      </defs>

      <rect width={width} height={height} fill="url(#sc-galaxy-bg)" />

      {/* connecting lines from current planet */}
      {current
        ? neighbours.map((n, i) => (
            <line
              key={`l-${i}`}
              x1={current.x}
              y1={current.y}
              x2={n.x}
              y2={n.y}
              stroke="url(#sc-galaxy-link)"
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.7}
            />
          ))
        : null}

      {positions.map((p) => {
        const isCurrent = p.planet.id === currentPlanetId;
        const radius = isCurrent ? 9 : 4 + Math.min(3, p.planet.terraformStage);
        const color = isCurrent
          ? "var(--sc-magenta)"
          : p.planet.scars.length > 0
            ? "var(--sc-amber)"
            : "var(--sc-cyan)";

        return (
          <g
            key={p.planet.id}
            tabIndex={0}
            role="button"
            aria-label={`Planet ${p.planet.repoName}`}
            onClick={(event) => onSelectPlanet?.(p.planet, event)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectPlanet?.(
                  p.planet,
                  event as unknown as MouseEvent<SVGGElement>,
                );
              }
            }}
            style={{
              cursor: onSelectPlanet ? "pointer" : "default",
              outline: "none",
            }}
          >
            {isCurrent ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={radius + 6}
                fill="none"
                stroke="var(--sc-magenta)"
                strokeWidth={1}
                opacity={0.6}
              />
            ) : null}
            <circle
              cx={p.x}
              cy={p.y}
              r={radius}
              fill={color}
              opacity={isCurrent ? 1 : 0.85}
              style={{
                filter: `drop-shadow(0 0 ${radius * 1.4}px ${color})`,
              }}
            />
            <text
              x={p.x + radius + 6}
              y={p.y + 3}
              fill="var(--sc-frost)"
              fontFamily="var(--sc-mono)"
              fontSize={10}
              opacity={0.78}
            >
              {p.planet.repoName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface Pos {
  readonly x: number;
  readonly y: number;
  readonly planet: Planet;
}

function positionPlanets(
  planets: readonly Planet[],
  width: number,
  height: number,
): readonly Pos[] {
  // Phyllotaxis (sunflower) — stable, looks like a constellation.
  const PHI = (1 + Math.sqrt(5)) / 2;
  const angleStep = (2 * Math.PI) / (PHI * PHI);
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) * 0.4;

  return planets.map((planet, i) => {
    const t = i + 1;
    const r = maxR * Math.sqrt(t / Math.max(1, planets.length));
    const theta = t * angleStep;
    return {
      planet,
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
    };
  });
}

function nearestNeighbours(
  current: Pos,
  all: readonly Pos[],
  k: number,
): readonly Pos[] {
  return [...all]
    .filter((p) => p.planet.id !== current.planet.id)
    .map((p) => ({ p, d: (p.x - current.x) ** 2 + (p.y - current.y) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((entry) => entry.p);
}
