import { createBrowserRouter } from "react-router-dom";
import {
  AppChrome,
  CockpitRoute,
  CombatRoute,
  DefeatRoute,
  FleetRoute,
  GalaxyRoute,
  IndexRoute,
  OperativeRoute,
  PlanetRoute,
  QuestForgeRoute,
  RosterRoute,
  VictoryRoute,
} from "@sandcastle/screens";

/**
 * Web build router. Same set of routes the Electron desktop renders —
 * mounted under the shared `<AppChrome />` from `@sandcastle/screens` so
 * the deploy chord, fleet dock, and decision-card flow behave identically
 * in both shells. The web's distinguishing detail is the connection
 * source: `main.tsx` reads `?endpoint=&token=` from the URL and gates the
 * router behind a `<ConnectScreen />` until both are present.
 */
export const router = createBrowserRouter([
  {
    element: <AppChrome />,
    children: [
      { path: "/", element: <IndexRoute /> },
      { path: "/fleet", element: <FleetRoute /> },
      { path: "/galaxy", element: <GalaxyRoute /> },
      { path: "/runs/:runId/cockpit", element: <CockpitRoute /> },
      { path: "/runs/:runId/combat", element: <CombatRoute /> },
      { path: "/runs/:runId/victory", element: <VictoryRoute /> },
      { path: "/runs/:runId/defeat", element: <DefeatRoute /> },
      { path: "/planet/:planetId", element: <PlanetRoute /> },
      { path: "/quest-forge", element: <QuestForgeRoute /> },
      { path: "/roster", element: <RosterRoute /> },
      { path: "/operatives/:operativeId", element: <OperativeRoute /> },
    ],
  },
]);
