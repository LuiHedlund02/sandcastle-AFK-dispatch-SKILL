import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import {
  TransportProvider,
  type SandcastleConnection,
} from "@sandcastle/transport";
import { router } from "./routes";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1_000,
    },
  },
});

// The Electron supervisor still owns connection acquisition — preload exposes
// `window.sandcastle` ({ port, token }) via contextBridge. We translate that
// into the transport-package's `SandcastleConnection` shape (baseUrl + token)
// once at boot and hand it down through React context, so renderer code never
// reads `window.sandcastle` directly.
const supervisor = window.sandcastle;
const connection: SandcastleConnection = {
  baseUrl: `http://127.0.0.1:${supervisor.port}`,
  token: supervisor.token,
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <TransportProvider connection={connection}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </TransportProvider>
  </StrictMode>,
);
