import { randomUUID } from "node:crypto";
import type { ActivityEvent, Run, RunEvent } from "@sandcastle/protocol";
import type { SqliteStore } from "../telemetry/SqliteStore.js";

export class ActivityFeed {
  constructor(private readonly store: SqliteStore) {}

  append(repoRoot: string, event: ActivityEvent): void {
    this.store.appendActivity(repoRoot, event);
  }

  recordRunEvent(repoRoot: string, run: Run, event: RunEvent): void {
    const activity = toActivityEvent(run, event);
    if (activity) this.append(repoRoot, activity);
  }

  getRecent(repoRoot: string, limit = 50): ActivityEvent[] {
    return this.store.listActivity(repoRoot, limit);
  }
}

const toActivityEvent = (run: Run, event: RunEvent): ActivityEvent | null => {
  const base = {
    id: randomUUID(),
    at: event.timestamp.toISOString(),
    runId: run.id,
    planetId: run.planetId,
    operativeId: run.operativeId,
  };

  switch (event.type) {
    case "run.started":
      return {
        ...base,
        type: "run.started",
        payload: { directive: event.directive },
      };
    case "run.statusChanged":
      return {
        ...base,
        type: "run.status-changed",
        payload: { from: event.from, to: event.to },
      };
    case "phase.started":
      return {
        ...base,
        type: "phase.updated",
        payload: { phaseId: event.phaseId, status: event.phase.status },
      };
    case "phase.verified":
      return {
        ...base,
        type: "phase.updated",
        payload: { phaseId: event.phaseId, status: "verified" },
      };
    case "phase.failed":
      return {
        ...base,
        type: "phase.updated",
        payload: { phaseId: event.phaseId, status: "failed" },
      };
    case "toolCall":
    case "tool.started":
      return {
        ...base,
        type: "tool.called",
        payload: {
          name: event.name,
          formattedArgs: event.formattedArgs,
        },
      };
    case "intervention.used":
      return {
        ...base,
        type: "intervention.used",
        payload: { action: event.action },
      };
    case "run.resolved":
      return {
        ...base,
        type: "run.resolved",
        payload: { result: event.result, xpDelta: event.xpDelta },
      };
    default:
      return null;
  }
};
