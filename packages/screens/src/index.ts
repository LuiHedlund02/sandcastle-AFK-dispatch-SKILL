/**
 * @sandcastle/screens — shared route components consumed by both the
 * Electron desktop renderer and the hosted web build.
 *
 * The components here are transport-agnostic: they consume `useApiClient()`
 * + `useFleetSocket()` from `@sandcastle/transport` and `@sandcastle/ui`
 * primitives. Mount the global `route-globals.css` once at the renderer
 * entry to pick up the route-specific class styles.
 */

export { AppChrome } from "./chrome/AppChrome";

export { useFleetStore } from "./state/fleetStore";

export {
  queryKeys,
  useActivity,
  useCancelRun,
  useCreateRun,
  useDecideRun,
  useEngageQuestForge,
  useFleet,
  useMergeAllGreen,
  useOperative,
  useOperativeXp,
  useOperatives,
  useQuestForgeParse,
  useRepo,
  useRepoDeck,
  useRepoTelemetry,
  useRepos,
  useRun,
} from "./api/queries";

export { IndexRoute } from "./routes/index";
export { CockpitRoute } from "./routes/runs.$runId.cockpit";
export { CombatRoute } from "./routes/runs.$runId.combat";
export { VictoryRoute } from "./routes/runs.$runId.victory";
export { DefeatRoute } from "./routes/runs.$runId.defeat";
export { FleetRoute } from "./routes/fleet";
export { PlanetRoute } from "./routes/planet.$planetId";
export { QuestForgeRoute } from "./routes/quest-forge";
export { RosterRoute } from "./routes/roster";
export { OperativeRoute } from "./routes/operatives.$operativeId";
