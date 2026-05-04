export interface GitHubRemote {
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
}

export const parseGitRemote = (remote: string | null): GitHubRemote | null => {
  if (!remote) return null;
  const trimmed = remote.trim();
  if (!trimmed) return null;

  const ssh = /^(?:ssh:\/\/)?git@([^:/]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(
    trimmed,
  );
  if (ssh) return normalize(ssh[1]!, ssh[2]!, ssh[3]!);

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const parts = url.pathname.replace(/^\/+/, "").split("/");
    if (parts.length < 2) return null;
    return normalize(url.hostname, parts[0]!, parts[1]!);
  } catch {
    return null;
  }
};

const normalize = (
  host: string,
  owner: string,
  rawRepo: string,
): GitHubRemote | null => {
  if (!host || !owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/, "");
  if (!repo || repo.includes("/")) return null;
  return { host, owner, repo };
};
