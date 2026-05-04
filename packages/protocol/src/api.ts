import { z } from "zod";
import { zFleetState, zRun } from "./state.js";

export const zPostRunsRequest = z.object({
  directive: z.string().min(1),
  provider: z.enum(["claude-code", "codex", "pi", "opencode"]).optional(),
  model: z.string().optional(),
  maxIterations: z.number().int().positive().optional(),
  completionSignal: z.union([z.string(), z.array(z.string())]).optional(),
});
export type PostRunsRequest = z.infer<typeof zPostRunsRequest>;

export const zPostRunsResponse = z.object({ runId: z.string() });
export type PostRunsResponse = z.infer<typeof zPostRunsResponse>;

export const zPostRunCancelRequest = z.object({ id: z.string() });
export type PostRunCancelRequest = z.infer<typeof zPostRunCancelRequest>;

export const zPostRunCancelResponse = z.object({
  runId: z.string(),
  cancelled: z.boolean(),
});
export type PostRunCancelResponse = z.infer<typeof zPostRunCancelResponse>;

export const zGetRunResponse = zRun;
export type GetRunResponse = z.infer<typeof zGetRunResponse>;

export const zGetFleetResponse = zFleetState;
export type GetFleetResponse = z.infer<typeof zGetFleetResponse>;

export const zGetRepoResponse = z.object({
  root: z.string(),
  branch: z.string(),
});
export type GetRepoResponse = z.infer<typeof zGetRepoResponse>;
