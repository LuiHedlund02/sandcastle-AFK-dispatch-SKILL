import {
  zGetActivityResponse,
  zGetFleetResponse,
  zGetOperativeResponse,
  zGetOperativeXpResponse,
  zGetOperativesResponse,
  zGetRepoDeckResponse,
  zGetRepoResponse,
  zGetRepoTelemetryResponse,
  zGetReposResponse,
  zGetRunResponse,
  zPostMergeAllGreenResponse,
  zPostQuestForgeEngageResponse,
  zPostQuestForgeParseResponse,
  zPostRunCancelResponse,
  zPostRunDecisionResponse,
  zPostRunsResponse,
  type GetActivityResponse,
  type GetFleetResponse,
  type GetOperativeResponse,
  type GetOperativeXpResponse,
  type GetOperativesResponse,
  type GetRepoDeckResponse,
  type GetRepoResponse,
  type GetRepoTelemetryResponse,
  type GetReposResponse,
  type GetRunResponse,
  type PostMergeAllGreenResponse,
  type PostQuestForgeEngageRequest,
  type PostQuestForgeEngageResponse,
  type PostQuestForgeParseResponse,
  type PostRunsRequest,
  type PostRunsResponse,
  type PostRunCancelResponse,
  type PostRunDecisionResponse,
  type RunDecisionKind,
} from "@sandcastle/protocol";

export interface SandcastleConnection {
  readonly port: number;
  readonly token: string;
}

const baseUrl = (
  connection: SandcastleConnection = window.sandcastle,
): string => `http://127.0.0.1:${connection.port}`;

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  connection: SandcastleConnection = window.sandcastle,
): Promise<T> => {
  const response = await fetch(`${baseUrl(connection)}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${connection.token}`,
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? JSON.stringify((payload as { error: unknown }).error)
        : response.statusText;
    throw new Error(message);
  }
  return payload as T;
};

export const apiClient = {
  async getFleet(): Promise<GetFleetResponse> {
    return zGetFleetResponse.parse(await requestJson<unknown>("/fleet"));
  },

  async getRepo(): Promise<GetRepoResponse> {
    return zGetRepoResponse.parse(await requestJson<unknown>("/repo"));
  },

  async getRun(runId: string): Promise<GetRunResponse> {
    return zGetRunResponse.parse(
      await requestJson<unknown>(`/runs/${encodeURIComponent(runId)}`),
    );
  },

  async createRun(request: PostRunsRequest): Promise<PostRunsResponse> {
    return zPostRunsResponse.parse(
      await requestJson<unknown>("/runs", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  },

  async cancelRun(runId: string): Promise<PostRunCancelResponse> {
    return zPostRunCancelResponse.parse(
      await requestJson<unknown>(`/runs/${encodeURIComponent(runId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ id: runId }),
      }),
    );
  },

  async decideRun(
    runId: string,
    kind: RunDecisionKind,
  ): Promise<PostRunDecisionResponse> {
    return zPostRunDecisionResponse.parse(
      await requestJson<unknown>(`/runs/${encodeURIComponent(runId)}/decide`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      }),
    );
  },

  async parseQuestForge(
    directive: string,
  ): Promise<PostQuestForgeParseResponse> {
    return zPostQuestForgeParseResponse.parse(
      await requestJson<unknown>("/quest-forge/parse", {
        method: "POST",
        body: JSON.stringify({ directive }),
      }),
    );
  },

  async engageQuestForge(
    request: PostQuestForgeEngageRequest,
  ): Promise<PostQuestForgeEngageResponse> {
    return zPostQuestForgeEngageResponse.parse(
      await requestJson<unknown>("/quest-forge/engage", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  },

  async mergeAllGreen(): Promise<PostMergeAllGreenResponse> {
    return zPostMergeAllGreenResponse.parse(
      await requestJson<unknown>("/merge-all-green", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  },

  async getRepos(): Promise<GetReposResponse> {
    return zGetReposResponse.parse(await requestJson<unknown>("/repos"));
  },

  async getRepoDeck(repoId: string): Promise<GetRepoDeckResponse> {
    return zGetRepoDeckResponse.parse(
      await requestJson<unknown>(`/repos/${encodeURIComponent(repoId)}/deck`),
    );
  },

  async getRepoTelemetry(
    repoId: string,
    options?: { force?: boolean },
  ): Promise<GetRepoTelemetryResponse> {
    const qs = options?.force ? "?force=true" : "";
    return zGetRepoTelemetryResponse.parse(
      await requestJson<unknown>(
        `/repos/${encodeURIComponent(repoId)}/telemetry${qs}`,
      ),
    );
  },

  async getOperatives(): Promise<GetOperativesResponse> {
    return zGetOperativesResponse.parse(
      await requestJson<unknown>("/operatives"),
    );
  },

  async getOperative(operativeId: string): Promise<GetOperativeResponse> {
    return zGetOperativeResponse.parse(
      await requestJson<unknown>(
        `/operatives/${encodeURIComponent(operativeId)}`,
      ),
    );
  },

  async getActivity(
    repoId: string,
    limit?: number,
  ): Promise<GetActivityResponse> {
    const qs =
      typeof limit === "number" ? `?limit=${encodeURIComponent(limit)}` : "";
    return zGetActivityResponse.parse(
      await requestJson<unknown>(
        `/repos/${encodeURIComponent(repoId)}/activity${qs}`,
      ),
    );
  },

  async getOperativeXp(operativeId: string): Promise<GetOperativeXpResponse> {
    return zGetOperativeXpResponse.parse(
      await requestJson<unknown>(
        `/operatives/${encodeURIComponent(operativeId)}/xp`,
      ),
    );
  },
};
