import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../../src/adapters/ClaudeCodeAdapter.js";
import {
  ProviderAdapterRegistry,
  UnknownProviderError,
} from "../../src/adapters/ProviderAdapterRegistry.js";

describe("ProviderAdapterRegistry", () => {
  it("gets adapters by provider id", () => {
    const registry = new ProviderAdapterRegistry([new ClaudeCodeAdapter()]);

    expect(registry.get("claude-code")).toBeInstanceOf(ClaudeCodeAdapter);
  });

  it("throws for unknown providers", () => {
    const registry = new ProviderAdapterRegistry([]);

    expect(() => registry.get("codex")).toThrow(UnknownProviderError);
  });

  it("lists registered adapters", () => {
    const registry = new ProviderAdapterRegistry();

    expect(registry.list().map((adapter) => adapter.id)).toEqual([
      "claude-code",
      "codex",
      "pi",
    ]);
  });
});
