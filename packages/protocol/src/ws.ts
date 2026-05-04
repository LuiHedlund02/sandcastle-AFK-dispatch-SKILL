import { z } from "zod";
import { zRunEvent } from "./events.js";
import { zFleetState } from "./state.js";

export const zWsServerMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    payload: z.object({ sessionId: z.string(), serverVersion: z.string() }),
  }),
  z.object({ type: z.literal("fleet.snapshot"), payload: zFleetState }),
  z.object({
    type: z.literal("run.event"),
    runId: z.string(),
    event: zRunEvent,
  }),
  z.object({
    type: z.literal("error"),
    payload: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type WsServerMessage = z.infer<typeof zWsServerMessage>;

export const zWsClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    payload: z.object({ runId: z.string().optional() }),
  }),
  z.object({ type: z.literal("ping") }),
]);
export type WsClientMessage = z.infer<typeof zWsClientMessage>;
