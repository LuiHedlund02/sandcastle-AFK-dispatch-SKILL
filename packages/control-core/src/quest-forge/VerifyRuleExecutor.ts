import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile, type ExecFileException } from "node:child_process";
import type { VerifyRule, VerifyRuleResult } from "@sandcastle/protocol";

export interface VerifyRuleExecutorOptions {
  readonly worktreePath: string;
  readonly baseCommit?: string;
  readonly timeoutMs?: number;
}

interface ExecResult {
  readonly exitCode: number;
  readonly output: string;
  readonly timedOut: boolean;
}

export class VerifyRuleExecutor {
  private readonly timeoutMs: number;

  constructor(private readonly options: VerifyRuleExecutorOptions) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async execute(rules: readonly VerifyRule[]): Promise<VerifyRuleResult[]> {
    const results: VerifyRuleResult[] = [];
    for (const rule of rules) {
      results.push(await this.executeOne(rule));
    }
    return results;
  }

  private async executeOne(rule: VerifyRule): Promise<VerifyRuleResult> {
    const started = Date.now();
    try {
      switch (rule.kind) {
        case "command": {
          const [file, ...args] = parseCommand(rule.command);
          if (!file) throw new Error("command cannot be empty");
          const result = await runExecFile(file, args, {
            cwd: this.options.worktreePath,
            timeoutMs: this.timeoutMs,
          });
          const expected = rule.expectExit ?? 0;
          return {
            rule,
            ok: !result.timedOut && result.exitCode === expected,
            output: result.output,
            durationMs: Date.now() - started,
          };
        }
        case "tests": {
          const args = ["vitest", "run"];
          if (rule.pattern && rule.pattern !== "all") args.push(rule.pattern);
          const result = await runExecFile(resolveBin("npx"), args, {
            cwd: this.options.worktreePath,
            timeoutMs: this.timeoutMs,
          });
          return {
            rule,
            ok: !result.timedOut && result.exitCode === 0,
            output: result.output,
            durationMs: Date.now() - started,
          };
        }
        case "file": {
          const absolute = join(this.options.worktreePath, rule.path);
          const present = existsSync(absolute);
          return {
            rule,
            ok: rule.mustExist ? present : !present,
            output: present ? "file exists" : "file does not exist",
            durationMs: Date.now() - started,
          };
        }
        case "commits": {
          if (!this.options.baseCommit) {
            return {
              rule,
              ok: false,
              output: "baseCommit is required for commits verify rules",
              durationMs: Date.now() - started,
            };
          }
          const result = await runExecFile(
            "git",
            ["rev-list", "--count", "HEAD", `^${this.options.baseCommit}`],
            {
              cwd: this.options.worktreePath,
              timeoutMs: this.timeoutMs,
            },
          );
          const count = Number.parseInt(result.output.trim(), 10);
          return {
            rule,
            ok:
              !result.timedOut &&
              result.exitCode === 0 &&
              Number.isFinite(count) &&
              count >= rule.minCount,
            output: result.output,
            durationMs: Date.now() - started,
          };
        }
      }
    } catch (error) {
      return {
        rule,
        ok: false,
        output: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      };
    }
  }
}

const runExecFile = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly timeoutMs: number },
): Promise<ExecResult> =>
  new Promise((resolve) => {
    execFile(
      resolveBin(file),
      [...args],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const execError = error as ExecFileException | null;
        const exitCode =
          typeof execError?.code === "number" ? execError.code : error ? 1 : 0;
        const timedOut = execError?.killed === true;
        const output = [stdout, stderr, timedOut ? "timed out" : ""]
          .filter(Boolean)
          .join("\n");
        resolve({ exitCode, output, timedOut });
      },
    );
  });

const parseCommand = (command: string): string[] => {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  for (const match of command.matchAll(re)) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }
  if (tokens.length === 0) throw new Error("command cannot be empty");
  return tokens;
};

const resolveBin = (file: string): string => {
  if (process.platform !== "win32") return file;
  if (file === "npm" || file === "npx") return `${file}.cmd`;
  return file;
};
