import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  AgentStreamEmitter,
  callbackAgentStreamEmitterLayer,
  type AgentStreamEvent,
} from "./AgentStreamEmitter.js";

const roundTrip = async (
  event: AgentStreamEvent,
): Promise<AgentStreamEvent[]> => {
  const events: AgentStreamEvent[] = [];
  await Effect.runPromise(
    Effect.gen(function* () {
      const emitter = yield* AgentStreamEmitter;
      yield* emitter.emit(event);
    }).pipe(
      Effect.provide(callbackAgentStreamEmitterLayer((e) => events.push(e))),
    ),
  );
  return events;
};

describe("callbackAgentStreamEmitterLayer", () => {
  it.each<AgentStreamEvent>([
    {
      type: "run.started",
      runId: "run_123",
      directive: "implement the thing",
      branch: "sandcastle/run_123",
      worktreePath: "/tmp/worktree",
      iteration: 0,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      type: "run.statusChanged",
      runId: "run_123",
      from: "starting",
      to: "casting",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:01.000Z"),
    },
    {
      type: "tool.started",
      name: "Bash",
      formattedArgs: "npm test",
      toolCallId: "tool_1",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:02.000Z"),
    },
    {
      type: "tool.finished",
      name: "Bash",
      toolCallId: "tool_1",
      durationMs: 42,
      ok: true,
      output: "ok",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:03.000Z"),
    },
    {
      type: "verification.started",
      checks: ["npm run typecheck", "npm run test"],
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:04.000Z"),
    },
    {
      type: "verification.finished",
      allGreen: false,
      failedChecks: ["npm run test"],
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:05.000Z"),
    },
    {
      type: "decision.required",
      kind: "merge",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:06.000Z"),
    },
    {
      type: "run.resolved",
      runId: "run_123",
      result: "victory",
      xpDelta: 0,
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:07.000Z"),
    },
    {
      type: "intervention.used",
      action: "abort",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:08.000Z"),
    },
  ])("round-trips $type events", async (event) => {
    await expect(roundTrip(event)).resolves.toEqual([event]);
  });

  it("continues to round-trip old text events", async () => {
    const event: AgentStreamEvent = {
      type: "text",
      message: "hello",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:09.000Z"),
    };

    await expect(roundTrip(event)).resolves.toEqual([event]);
  });

  it("continues to round-trip old toolCall events", async () => {
    const event: AgentStreamEvent = {
      type: "toolCall",
      name: "Bash",
      formattedArgs: "npm test",
      iteration: 1,
      timestamp: new Date("2026-01-01T00:00:10.000Z"),
    };

    await expect(roundTrip(event)).resolves.toEqual([event]);
  });
});
