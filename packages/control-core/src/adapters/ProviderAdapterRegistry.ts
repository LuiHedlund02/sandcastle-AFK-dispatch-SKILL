import type { ProviderId } from "@sandcastle/protocol";
import type { AgentProviderAdapter } from "./AgentProviderAdapter.js";
import { ClaudeCodeAdapter } from "./ClaudeCodeAdapter.js";
import { CodexAdapter } from "./CodexAdapter.js";
import { PiAdapter } from "./PiAdapter.js";

export class UnknownProviderError extends Error {
  readonly code = "UNKNOWN_PROVIDER";

  constructor(readonly providerId: ProviderId | string) {
    super(`No provider adapter registered for '${providerId}'`);
    this.name = "UnknownProviderError";
  }
}

export class ProviderAdapterRegistry {
  private readonly adapters = new Map<ProviderId, AgentProviderAdapter>();

  constructor(adapters: readonly AgentProviderAdapter[] = defaultAdapters()) {
    for (const adapter of adapters) this.adapters.set(adapter.id, adapter);
  }

  get(providerId: ProviderId): AgentProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new UnknownProviderError(providerId);
    return adapter;
  }

  list(): readonly AgentProviderAdapter[] {
    return [...this.adapters.values()];
  }
}

export const defaultAdapters = (): readonly AgentProviderAdapter[] => [
  new ClaudeCodeAdapter(),
  new CodexAdapter(),
  new PiAdapter(),
];
