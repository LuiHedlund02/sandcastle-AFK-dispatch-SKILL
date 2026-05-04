import {
  zGetFleetResponse,
  zGetOperativeResponse,
  zGetOperativesResponse,
  zGetRepoDeckResponse,
  zGetRepoResponse,
  zGetRepoTelemetryResponse,
  zGetReposResponse,
  zGetRunResponse,
  zPostRunCancelResponse,
  zPostRunsResponse,
  type GetFleetResponse,
  type GetOperativeResponse,
  type GetOperativesResponse,
  type GetRepoDeckResponse,
  type GetRepoResponse,
  type GetRepoTelemetryResponse,
  type GetReposResponse,
  type GetRunResponse,
  type PostRunsRequest,
  type PostRunsResponse,
  type PostRunCancelResponse,
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
};
