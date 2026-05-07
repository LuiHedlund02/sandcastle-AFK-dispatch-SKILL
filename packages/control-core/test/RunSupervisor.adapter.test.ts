import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentProvider } from "@ai-hero/sandcastle";
import { RunSupervisor } from "../src/runs/RunSupervisor.js";
import { SqliteStore } from "../src/telemetry/SqliteStore.js";
import { makeRepo, waitFor } from "./helpers.js";

describe("RunSupervisor provider adapter integration", () => {
  it("materializes Claude Code files for the agent and cleans them up", async () => {
    const repo = makeRepo();
    mkdirSync(join(repo, ".sandcastle", "skills"), { recursive: true });
    mkdirSync(join(repo, ".sandcastle", "commands"), { recursive: true });
    writeFileSync(
      join(repo, ".sandcastle", "agents.md"),
      "You are a focused test operative.\n",
    );
    writeFileSync(
      join(repo, ".sandcastle", "skills", "inspect.md"),
      "Inspect provider files.\n",
    );
    writeFileSync(
      join(repo, ".sandcastle", "commands", "verify.md"),
      "---\nslashCommand: /verify\n---\nVerify cleanup.\n",
    );

    const store = new SqliteStore(repo);
    try {
      const supervisor = new RunSupervisor({
        repoRoot: repo,
        store,
        agentFactory: () => materializationCheckingAgent(),
      });

      const { runId } = await supervisor.startRun({
        directive: "do it",
        provider: "claude-code",
        branchStrategy: { type: "head" },
      });

      await waitFor(() => supervisor.getRun(runId)?.status === "win-pending");
      await waitFor(() => !existsSync(join(repo, ".claude")));

      expect(existsSync(join(repo, ".claude"))).toBe(false);
    } finally {
      store.close();
    }
  }, 10000);
});

const materializationCheckingAgent = (): AgentProvider => ({
  name: "materialization-checking-agent",
  env: {},
  captureSessions: false,
  buildPrintCommand: () => ({
    command:
      "node -e \"const fs=require('fs'); if(!fs.existsSync('.claude/agents.md')) process.exit(7); console.log(JSON.stringify({type:'result',result:'<promise>COMPLETE</promise>'}));\"",
  }),
  parseStreamLine: (line: string) => {
    if (!line.startsWith("{")) return [];
    const obj = JSON.parse(line);
    if (obj.type === "result")
      return [{ type: "result" as const, result: obj.result }];
    return [];
  },
});
