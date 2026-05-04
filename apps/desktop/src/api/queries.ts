import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostRunsRequest, RunDecisionKind } from "@sandcastle/protocol";
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
