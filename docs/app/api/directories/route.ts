import { readdir, stat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, parse, resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DirectoryEntry = {
  name: string;
  path: string;
};

async function getWindowsRoots() {
  const roots: DirectoryEntry[] = [];

  await Promise.all(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(async (letter) => {
      const drive = `${letter}:\\`;
      try {
        const driveStat = await stat(drive);
        if (driveStat.isDirectory()) {
          roots.push({ name: drive, path: drive });
        }
      } catch {
        // Ignore drives that do not exist or are not accessible.
      }
    }),
  );

  return roots.sort((a, b) => a.name.localeCompare(b.name));
}

async function getRoots() {
  if (platform() === "win32") {
    return getWindowsRoots();
  }

  return [{ name: "/", path: "/" }];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedPath = url.searchParams.get("path") || homedir();
  const targetPath = resolve(requestedPath);

  try {
    const targetStat = await stat(targetPath);
    if (!targetStat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 },
      );
    }

    const entries = await readdir(targetPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: resolve(targetPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const root = parse(targetPath).root;
    const parent = targetPath === root ? null : dirname(targetPath);

    return NextResponse.json({
      path: targetPath,
      parent,
      roots: await getRoots(),
      entries: directories,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not read directory",
      },
      { status: 500 },
    );
  }
}
