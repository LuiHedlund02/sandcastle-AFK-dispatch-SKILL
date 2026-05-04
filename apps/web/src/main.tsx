import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import {
  TransportProvider,
  type SandcastleConnection,
} from "@sandcastle/transport";
import { router } from "./routes";
import { ConnectScreen } from "./ConnectScreen";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1_000,
    },
  },
});

/**
 * Read `?endpoint=<base>&token=<t>` from the URL. If both are present, we
 * consider the user "connected" and render the routes. Otherwise we render
 * the {@link ConnectScreen} so they can paste a token.
 */
function readConnection(): SandcastleConnection | null {
  const params = new URLSearchParams(window.location.search);
  const endpoint = params.get("endpoint");
  const token = params.get("token");
  if (!endpoint || !token) return null;
  return {
    baseUrl: endpoint.replace(/\/+$/, ""),
    token,
  };
}

const connection = readConnection();
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    {connection ? (
      <TransportProvider connection={connection}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </TransportProvider>
    ) : (
      <ConnectScreen />
    )}
  </StrictMode>,
);
