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

export const router = createBrowserRouter([
  {
    element: <AppChrome />,
    children: [
      { path: "/", element: <IndexRoute /> },
      { path: "/runs/:runId/cockpit", element: <CockpitRoute /> },
      { path: "/runs/:runId/combat", element: <CombatRoute /> },
      { path: "/runs/:runId/victory", element: <VictoryRoute /> },
      { path: "/runs/:runId/defeat", element: <DefeatRoute /> },
      { path: "/fleet", element: <FleetRoute /> },
      { path: "/galaxy", element: <GalaxyRoute /> },
      { path: "/planet/:planetId", element: <PlanetRoute /> },
      { path: "/quest-forge", element: <QuestForgeRoute /> },
      { path: "/roster", element: <RosterRoute /> },
      { path: "/operatives/:operativeId", element: <OperativeRoute /> },
    ],
  },
]);
