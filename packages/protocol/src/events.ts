import { z } from "zod";
import { zRunStatus } from "./state.js";

const zTimestamp = z.coerce.date();
const zBase = z.object({
  iteration: z.number(),
  timestamp: zTimestamp,
});

export const zTextRunEvent = zBase.extend({
  type: z.literal("text"),
  message: z.string(),
});

export const zToolCallRunEvent = zBase.extend({
  type: z.literal("toolCall"),
  name: z.string(),
  formattedArgs: z.string(),
});

export const zRunStartedEvent = zBase.extend({
  type: z.literal("run.started"),
  runId: z.string(),
  directive: z.string(),
  branch: z.string(),
  worktreePath: z.string().optional(),
});

export const zRunStatusChangedEvent = zBase.extend({
  type: z.literal("run.statusChanged"),
  runId: z.string(),
  from: zRunStatus,
  to: zRunStatus,
});

export const zToolStartedEvent = zBase.extend({
  type: z.literal("tool.started"),
  name: z.string(),
  formattedArgs: z.string(),
  toolCallId: z.string(),
});

export const zToolFinishedEvent = zBase.extend({
  type: z.literal("tool.finished"),
  name: z.string(),
  toolCallId: z.string(),
  durationMs: z.number(),
  ok: z.boolean(),
  output: z.string().optional(),
});

export const zVerificationStartedEvent = zBase.extend({
  type: z.literal("verification.started"),
  checks: z.array(z.string()),
});

export const zVerificationFinishedEvent = zBase.extend({
  type: z.literal("verification.finished"),
  allGreen: z.boolean(),
  failedChecks: z.array(z.string()),
});

export const zDecisionRequiredEvent = zBase.extend({
  type: z.literal("decision.required"),
  kind: z.enum(["merge", "revise", "discard"]),
});

export const zRunResolvedEvent = zBase.extend({
  type: z.literal("run.resolved"),
  runId: z.string(),
  result: z.enum(["victory", "defeat", "aborted"]),
  xpDelta: z.number(),
});

export const zInterventionUsedEvent = zBase.extend({
  type: z.literal("intervention.used"),
  action: z.string(),
});

export const zRunEvent = z.discriminatedUnion("type", [
  zTextRunEvent,
  zToolCallRunEvent,
  zRunStartedEvent,
  zRunStatusChangedEvent,
  zToolStartedEvent,
  zToolFinishedEvent,
  zVerificationStartedEvent,
  zVerificationFinishedEvent,
  zDecisionRequiredEvent,
  zRunResolvedEvent,
  zInterventionUsedEvent,
]);

export type RunEvent = z.infer<typeof zRunEvent>;
