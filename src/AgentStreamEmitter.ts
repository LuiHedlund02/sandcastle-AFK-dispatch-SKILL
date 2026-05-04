import { Context, Effect, Layer } from "effect";

export type RunStatus =
  | "queued"
  | "starting"
  | "casting"
  | "striking"
  | "verifying"
  | "win-pending"
  | "fail-pending"
  | "victory"
  | "defeat"
  | "aborted";

/**
 * A single event in the agent's output stream, surfaced to callers of `run()`
 * so they can forward it to their own observability system.
 *
 * Emitted only in log-to-file mode when an `onAgentStreamEvent` callback is
 * provided via `logging`. See `run()`.
 */
export type AgentStreamEvent =
  | {
      readonly type: "text";
      readonly message: string;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "toolCall";
      readonly name: string;
      readonly formattedArgs: string;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "run.started";
      readonly runId: string;
      readonly directive: string;
      readonly branch: string;
      readonly worktreePath?: string;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "run.statusChanged";
      readonly runId: string;
      readonly from: RunStatus;
      readonly to: RunStatus;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "tool.started";
      readonly name: string;
      readonly formattedArgs: string;
      readonly toolCallId: string;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "tool.finished";
      readonly name: string;
      readonly toolCallId: string;
      readonly durationMs: number;
      readonly ok: boolean;
      readonly output?: string;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "verification.started";
      readonly checks: readonly string[];
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "verification.finished";
      readonly allGreen: boolean;
      readonly failedChecks: readonly string[];
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "decision.required";
      readonly kind: "merge" | "revise" | "discard";
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "run.resolved";
      readonly runId: string;
      readonly result: "victory" | "defeat" | "aborted";
      readonly xpDelta: number;
      readonly iteration: number;
      readonly timestamp: Date;
    }
  | {
      readonly type: "intervention.used";
      readonly action: string;
      readonly iteration: number;
      readonly timestamp: Date;
    };

export interface AgentStreamEmitterService {
  readonly emit: (event: AgentStreamEvent) => Effect.Effect<void>;
}

export class AgentStreamEmitter extends Context.Tag("AgentStreamEmitter")<
  AgentStreamEmitter,
  AgentStreamEmitterService
>() {}

export const noopAgentStreamEmitterLayer: Layer.Layer<AgentStreamEmitter> =
  Layer.succeed(AgentStreamEmitter, { emit: () => Effect.void });

/**
 * Build a layer that forwards each event to the provided callback.
 * The callback is invoked synchronously inside an `Effect.sync`; any error
 * thrown by the callback is caught and discarded so observability failures
 * cannot kill the run.
 */
export const callbackAgentStreamEmitterLayer = (
  onEvent: (event: AgentStreamEvent) => void,
): Layer.Layer<AgentStreamEmitter> =>
  Layer.succeed(AgentStreamEmitter, {
    emit: (event) =>
      Effect.sync(() => {
        try {
          onEvent(event);
        } catch {
          // Swallow callback errors — a broken forwarder must not kill the run.
        }
      }),
  });
