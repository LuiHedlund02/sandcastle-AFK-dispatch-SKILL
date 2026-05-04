import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { AgentProvider } from "@ai-hero/sandcastle";

export const makeRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "sandcastle-control-"));
  execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
  });
  writeFileSync(join(dir, "README.md"), "# test\n");
  execFileSync("git", ["add", "README.md"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, ".sandcastle", "logs"), { recursive: true });
  return dir;
};

export const fakeAgent = (options?: {
  delayMs?: number;
  completion?: boolean;
}): AgentProvider => {
  const delay = options?.delayMs ?? 0;
  const completion = options?.completion ?? true;
  return {
    name: "fake-agent",
    env: {},
    captureSessions: false,
    buildPrintCommand: () => {
      // Write the script to a temp .mjs file so Windows cmd.exe quoting
      // doesn't mangle inline `node -e` payloads.
      const result = completion
        ? "<promise>COMPLETE</promise>"
        : "not complete";
      const script = `const emit = (obj) => console.log(JSON.stringify(obj));
emit({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello ' }] } });
emit({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'echo ok' } }] } });
setTimeout(() => {
  emit({ type: 'assistant', message: { content: [{ type: 'text', text: 'world' }] } });
  emit({ type: 'result', result: ${JSON.stringify(result)} });
}, ${delay});
`;
      const scriptPath = join(
        tmpdir(),
        `sandcastle-fake-agent-${randomBytes(6).toString("hex")}.mjs`,
      );
      writeFileSync(scriptPath, script);
      // Path has no spaces (Windows tmpdir is under
      // C:\Users\<user>\AppData\Local\Temp); pass unquoted so the engine's
      // shell command construction doesn't mangle the absolute path on
      // Windows.
      return { command: `node ${scriptPath}` };
    },
    parseStreamLine: (line: string) => {
      if (!line.startsWith("{")) return [];
      const obj = JSON.parse(line);
      if (obj.type === "assistant") {
        return obj.message.content.flatMap((block: any) => {
          if (block.type === "text")
            return [{ type: "text" as const, text: block.text }];
          if (block.type === "tool_use")
            return [
              {
                type: "tool_call" as const,
                name: block.name,
                args: block.input.command,
              },
            ];
          return [];
        });
      }
      if (obj.type === "result")
        return [{ type: "result" as const, result: obj.result }];
      return [];
    },
  };
};

export const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs)
      throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
