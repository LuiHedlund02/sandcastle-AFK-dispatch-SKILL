import { createBrowserRouter } from "react-router-dom";
import { AppChrome } from "./AppChrome";
import { IndexRoute } from "./routes/index";
import { CockpitRoute } from "./routes/runs.$runId.cockpit";
import { CombatRoute } from "./routes/runs.$runId.combat";
import { FleetRoute } from "./routes/fleet";
import { PlanetRoute } from "./routes/planet.$planetId";
import { QuestForgeRoute } from "./routes/quest-forge";
import { RosterRoute } from "./routes/roster";
import { OperativeRoute } from "./routes/operatives.$operativeId";

export const router = createBrowserRouter([
  {
    element: <AppChrome />,
    children: [
      { path: "/", element: <IndexRoute /> },
      { path: "/runs/:runId/cockpit", element: <CockpitRoute /> },
      { path: "/runs/:runId/combat", element: <CombatRoute /> },
      { path: "/fleet", element: <FleetRoute /> },
      { path: "/planet/:planetId", element: <PlanetRoute /> },
      { path: "/quest-forge", element: <QuestForgeRoute /> },
      { path: "/roster", element: <RosterRoute /> },
      { path: "/operatives/:operativeId", element: <OperativeRoute /> },
    ],
  },
]);
