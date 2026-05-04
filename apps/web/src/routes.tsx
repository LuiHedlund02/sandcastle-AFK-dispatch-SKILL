import type { JSX } from "react";
import { createBrowserRouter, Link, NavLink, Outlet } from "react-router-dom";
import { useTransport } from "@sandcastle/transport";
import { CockpitRoute } from "./routes/cockpit";
import { FleetRoute } from "./routes/fleet";

function PlaceholderRoute({ name }: { readonly name: string }): JSX.Element {
  return (
    <section className="web-route">
      <h1>{name}</h1>
      <p className="placeholder">
        Not in the v1 web build. The Electron desktop renderer renders this
        route — re-using the desktop screens here ships in Phase 7+.
      </p>
      <p>
        <Link to="/fleet">← Fleet</Link>
      </p>
    </section>
  );
}

function Shell(): JSX.Element {
  const { connection } = useTransport();
  return (
    <div>
      <nav className="web-nav">
        <NavLink
          to="/fleet"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Fleet
        </NavLink>
        <NavLink
          to="/roster"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Roster
        </NavLink>
        <span className="endpoint">{connection.baseUrl}</span>
      </nav>
      <Outlet />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: "/", element: <FleetRoute /> },
      { path: "/fleet", element: <FleetRoute /> },
      { path: "/runs/:runId/cockpit", element: <CockpitRoute /> },
      // Phase 7+ — placeholders so router doesn't 404 on shared links.
      {
        path: "/runs/:runId/combat",
        element: <PlaceholderRoute name="Combat" />,
      },
      {
        path: "/runs/:runId/victory",
        element: <PlaceholderRoute name="Victory" />,
      },
      {
        path: "/runs/:runId/defeat",
        element: <PlaceholderRoute name="Defeat" />,
      },
      {
        path: "/planet/:planetId",
        element: <PlaceholderRoute name="Planet" />,
      },
      {
        path: "/quest-forge",
        element: <PlaceholderRoute name="Quest Forge" />,
      },
      { path: "/roster", element: <PlaceholderRoute name="Roster" /> },
      {
        path: "/operatives/:operativeId",
        element: <PlaceholderRoute name="Operative" />,
      },
    ],
  },
]);
