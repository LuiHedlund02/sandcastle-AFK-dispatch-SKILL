import { mkdir, rm, writeFile, rename } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ProviderAdapterOutput,
  ProviderMaterializedFile,
} from "./AgentProviderAdapter.js";

export class InvalidProviderPathError extends Error {
  readonly code = "INVALID_PROVIDER_PATH";

  constructor(readonly relativePath: string) {
    super(
      `Provider materialization path must stay inside the worktree: ${relativePath}`,
    );
    this.name = "InvalidProviderPathError";
  }
}

export const materializeProviderFiles = async (
  worktreeRoot: string,
  output: Pick<ProviderAdapterOutput, "files">,
): Promise<void> => {
  for (const file of output.files) {
    await writeAtomic(worktreeRoot, file);
  }
};

export const cleanupProviderPaths = async (
  worktreeRoot: string,
  cleanupPaths: readonly string[] | undefined,
  warn: (message: string, error?: unknown) => void = defaultWarn,
): Promise<void> => {
  for (const cleanupPath of cleanupPaths ?? []) {
    try {
      const target = resolveProviderPath(worktreeRoot, cleanupPath);
      await rm(target, { recursive: true, force: true });
    } catch (error) {
      warn(
        `Failed to clean provider materialization path: ${cleanupPath}`,
        error,
      );
    }
  }
};

export const assertProviderRelativePath = (relativePath: string): void => {
  if (
    relativePath.length === 0 ||
    isAbsolute(relativePath) ||
    relativePath.split(/[\\/]+/g).includes("..")
  ) {
    throw new InvalidProviderPathError(relativePath);
  }
};

export const resolveProviderPath = (
  worktreeRoot: string,
  relativePath: string,
): string => {
  assertProviderRelativePath(relativePath);
  const root = resolve(worktreeRoot);
  const target = resolve(root, relativePath);
  const back = relative(root, target);
  if (back === "" || (!back.startsWith("..") && !isAbsolute(back))) {
    return target;
  }
  throw new InvalidProviderPathError(relativePath);
};

const writeAtomic = async (
  worktreeRoot: string,
  file: ProviderMaterializedFile,
): Promise<void> => {
  const target = resolveProviderPath(worktreeRoot, file.relativePath);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.sandcastle-${process.pid}-${randomUUID()}.tmp`;
  await writeFile(temporary, file.content, "utf8");
  await rename(temporary, target);
};

const defaultWarn = (message: string, error?: unknown): void => {
  console.warn("[sandcastle-control] " + message, error ?? "");
};
