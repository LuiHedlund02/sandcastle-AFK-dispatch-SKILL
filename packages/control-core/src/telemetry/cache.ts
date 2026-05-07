import type { SqliteStore } from "./SqliteStore.js";

export const CACHE_TTL_MS = 60_000;

export const readCached = <T>(
  store: SqliteStore | undefined,
  repoRoot: string,
  domain: string,
): T | undefined => {
  const cached = store?.getDomainCache<T>(repoRoot, domain);
  if (!cached) return undefined;
  if (Date.now() - Date.parse(cached.indexedAt) > CACHE_TTL_MS)
    return undefined;
  return cached.value;
};

export const writeCached = (
  store: SqliteStore | undefined,
  repoRoot: string,
  domain: string,
  value: unknown,
): void => {
  store?.setDomainCache(repoRoot, domain, value);
};
