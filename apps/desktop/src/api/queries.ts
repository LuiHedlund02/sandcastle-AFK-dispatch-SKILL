import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PostQuestForgeEngageRequest,
  PostRunsRequest,
  RunDecisionKind,
} from "@sandcastle/protocol";
import { apiClient } from "./client";

export const queryKeys = {
  fleet: ["fleet"] as const,
  repo: ["repo"] as const,
  run: (runId: string) => ["run", runId] as const,
  repos: ["repos"] as const,
  repoDeck: (repoId: string) => ["repo", repoId, "deck"] as const,
  repoTelemetry: (repoId: string) => ["repo", repoId, "telemetry"] as const,
  operatives: ["operatives"] as const,
  operative: (operativeId: string) => ["operative", operativeId] as const,
  operativeXp: (operativeId: string) =>
    ["operative", operativeId, "xp"] as const,
  repoActivity: (repoId: string, limit: number) =>
    ["repo", repoId, "activity", limit] as const,
  questForgeParse: (directive: string) =>
    ["quest-forge", "parse", directive] as const,
};

/**
 * Debounces the directive on the way to `apiClient.parseQuestForge`. Disabled
 * for inputs <= 4 chars (control-core's parser is cheap, but we don't want
 * to spam it on every keystroke). The debounce is 300ms; the query key is
 * the (debounced) directive, so React Query natively dedupes identical
 * snapshots.
 */
export const useQuestForgeParse = (
  directive: string,
  options?: { readonly debounceMs?: number; readonly minChars?: number },
) => {
  const debounceMs = options?.debounceMs ?? 300;
  const minChars = options?.minChars ?? 4;
  const [debounced, setDebounced] = useState(directive);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(directive), debounceMs);
    return () => clearTimeout(handle);
  }, [directive, debounceMs]);
  return useQuery({
    queryKey: queryKeys.questForgeParse(debounced),
    queryFn: () => apiClient.parseQuestForge(debounced),
    enabled: debounced.trim().length > minChars,
    staleTime: 30_000,
  });
};

export const useEngageQuestForge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PostQuestForgeEngageRequest) =>
      apiClient.engageQuestForge(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.fleet });
    },
  });
};

export const useFleet = () =>
  useQuery({
    queryKey: queryKeys.fleet,
    queryFn: () => apiClient.getFleet(),
  });

export const useRepo = () =>
  useQuery({
    queryKey: queryKeys.repo,
    queryFn: () => apiClient.getRepo(),
  });

export const useRun = (runId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.run(runId ?? ""),
    queryFn: () => apiClient.getRun(runId ?? ""),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "victory" || status === "defeat" || status === "aborted"
        ? false
        : 2_000;
    },
  });

export const useCreateRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PostRunsRequest) => apiClient.createRun(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.fleet });
    },
  });
};

export const useCancelRun = (runId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.cancelRun(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.fleet });
    },
  });
};

export const useDecideRun = (runId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kind: RunDecisionKind) => apiClient.decideRun(runId, kind),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.fleet });
    },
  });
};

export const useMergeAllGreen = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.mergeAllGreen(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.fleet });
    },
  });
};

export const useRepos = () =>
  useQuery({ queryKey: queryKeys.repos, queryFn: () => apiClient.getRepos() });

export const useRepoDeck = (repoId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.repoDeck(repoId ?? ""),
    queryFn: () => apiClient.getRepoDeck(repoId ?? ""),
    enabled: Boolean(repoId),
  });

export const useRepoTelemetry = (repoId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.repoTelemetry(repoId ?? ""),
    queryFn: () => apiClient.getRepoTelemetry(repoId ?? ""),
    enabled: Boolean(repoId),
  });

export const useOperatives = () =>
  useQuery({
    queryKey: queryKeys.operatives,
    queryFn: () => apiClient.getOperatives(),
  });

export const useOperative = (operativeId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.operative(operativeId ?? ""),
    queryFn: () => apiClient.getOperative(operativeId ?? ""),
    enabled: Boolean(operativeId),
  });

/**
 * Recent ActivityEvents for a repo. Default limit is 10 (planet screen);
 * the backend caps at 50.
 */
export const useActivity = (repoId: string | undefined, limit = 10) =>
  useQuery({
    queryKey: queryKeys.repoActivity(repoId ?? "", limit),
    queryFn: () => apiClient.getActivity(repoId ?? "", limit),
    enabled: Boolean(repoId),
    // Activity is append-only; refetch lazily.
    staleTime: 5_000,
  });

/** Operative XP summary — totalXp + recent merges. */
export const useOperativeXp = (operativeId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.operativeXp(operativeId ?? ""),
    queryFn: () => apiClient.getOperativeXp(operativeId ?? ""),
    enabled: Boolean(operativeId),
    staleTime: 5_000,
  });
