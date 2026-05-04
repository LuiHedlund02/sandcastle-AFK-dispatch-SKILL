import type { Phase, Run, RunEvent, RunStatus } from "@sandcastle/protocol";

const OPERATIVE_ID = "pi-default";
const PLANET_ID = "planet-local";

export class RunEventProjector {
  private readonly runs = new Map<string, Run>();
  private readonly phases = new Map<string, Phase>();

  createQueued(input: {
    readonly id: string;
    readonly directive: string;
    readonly branch: string;
    readonly worktreePath?: string;
    readonly operativeId?: string;
    readonly provider?: Run["provider"];
    readonly sandboxProvider?: string;
    readonly startedAt?: string;
    readonly phaseIds?: readonly string[];
  }): Run {
    const existing = this.runs.get(input.id);
    if (existing) return existing;
    const run: Run = {
      id: input.id,
      planetId: PLANET_ID,
      operativeId: input.operativeId ?? OPERATIVE_ID,
      provider: input.provider ?? "codex",
      sandboxProvider: input.sandboxProvider ?? "no-sandbox",
      status: "queued",
      directive: input.directive,
      branch: input.branch,
      worktreePath: input.worktreePath,
      startedAt: input.startedAt ?? new Date().toISOString(),
      endedAt: null,
      phaseIds: [...(input.phaseIds ?? [])],
      currentPhaseId: null,
      verification: { allGreen: false, failedChecks: [] },
      totals: { toolCalls: 0, filesEdited: 0, commandsRun: 0 },
    };
    this.runs.set(input.id, run);
    return run;
  }

  project(event: RunEvent, fallbackRunId?: string): Run | undefined {
    const runId = "runId" in event ? event.runId : fallbackRunId;
    if (!runId) return undefined;

    let run = this.runs.get(runId);
    if (event.type === "run.started") {
      run = this.createQueued({
        id: event.runId,
        directive: event.directive,
        branch: event.branch,
        startedAt: event.timestamp.toISOString(),
      });
      run = {
        ...run,
        status: "starting",
        directive: event.directive,
        branch: event.branch,
        worktreePath: event.worktreePath ?? run.worktreePath,
        startedAt: event.timestamp.toISOString(),
      };
      this.runs.set(runId, run);
      return run;
    }
    if (!run) return undefined;

    const transition = (status: RunStatus): void => {
      run = { ...run!, status };
    };

    switch (event.type) {
      case "run.statusChanged":
        transition(event.to);
        break;
      case "text":
      case "toolCall":
      case "tool.started":
        if (run.status === "queued" || run.status === "starting") {
          transition("casting");
        }
        if (event.type === "toolCall" || event.type === "tool.started") {
          run = {
            ...run!,
            totals: {
              ...run!.totals,
              toolCalls:
                run!.totals.toolCalls + (event.type === "tool.started" ? 1 : 0),
              commandsRun:
                event.name === "Bash" && event.type === "tool.started"
                  ? run!.totals.commandsRun + 1
                  : run!.totals.commandsRun,
            },
          };
        }
        break;
      case "verification.started":
        transition("verifying");
        break;
      case "verification.finished":
        run = {
          ...run,
          status: event.allGreen ? "win-pending" : "fail-pending",
          verification: {
            allGreen: event.allGreen,
            failedChecks: [...event.failedChecks],
            failedPhaseId: event.failedPhaseId,
          },
        };
        break;
      case "phase.started":
        this.phases.set(event.phaseId, event.phase);
        run = {
          ...run,
          status: "casting",
          phaseIds: run.phaseIds.includes(event.phaseId)
            ? run.phaseIds
            : [...run.phaseIds, event.phaseId],
          currentPhaseId: event.phaseId,
        };
        break;
      case "phase.verifying": {
        const phase = this.phases.get(event.phaseId);
        if (phase)
          this.phases.set(event.phaseId, { ...phase, status: "active" });
        transition("verifying");
        break;
      }
      case "phase.verified": {
        const phase = this.phases.get(event.phaseId);
        if (phase) {
          this.phases.set(event.phaseId, {
            ...phase,
            status: "verified",
            endedAt: event.timestamp.toISOString(),
          });
        }
        run = { ...run, currentPhaseId: null };
        break;
      }
      case "phase.failed": {
        const phase = this.phases.get(event.phaseId);
        if (phase) {
          this.phases.set(event.phaseId, {
            ...phase,
            status: "failed",
            endedAt: event.timestamp.toISOString(),
          });
        }
        run = { ...run, currentPhaseId: event.phaseId };
        break;
      }
      case "run.resolved":
        if (event.result === "aborted") {
          for (const phaseId of run.phaseIds) {
            const phase = this.phases.get(phaseId);
            if (
              phase &&
              (phase.status === "pending" || phase.status === "active")
            ) {
              this.phases.set(phaseId, {
                ...phase,
                status: "skipped",
                endedAt: event.timestamp.toISOString(),
              });
            }
          }
        }
        run = {
          ...run,
          status: event.result,
          endedAt: event.timestamp.toISOString(),
        };
        break;
      case "tool.finished":
      case "decision.required":
      case "intervention.used":
        break;
    }

    this.runs.set(runId, run);
    return run;
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }

  listRuns(): Run[] {
    return [...this.runs.values()];
  }

  listPhases(): Phase[] {
    return [...this.phases.values()];
  }
}
