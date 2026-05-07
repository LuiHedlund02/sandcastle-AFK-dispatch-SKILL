import type {
  Deck,
  OperativeIdentity,
  Planet,
  ProviderId,
  Run,
} from "@sandcastle/protocol";

export interface ProviderMaterializedFile {
  relativePath: string;
  content: string;
}

export interface ProviderAdapterInput {
  repoRoot: string;
  sandcastleDir: string;
  deck: Deck;
  planet: Planet;
  operative: OperativeIdentity;
  run: Run;
  directive: string;
}

export interface ProviderAdapterOutput {
  files: ProviderMaterializedFile[];
  env?: Record<string, string>;
  promptPrelude?: string;
  cleanupPaths?: string[];
}

export interface AgentProviderAdapter {
  id: ProviderId;
  materialize(input: ProviderAdapterInput): Promise<ProviderAdapterOutput>;
}
