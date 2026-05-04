import { describe, expect, it } from "vitest";
import type { GitHubClient } from "../../../src/github/GitHubClient.js";
import { readCiGreenRate30d } from "../../../src/telemetry/ci/CiRateReader.js";
import { makeRepo } from "../../helpers.js";

describe("CiRateReader", () => {
  it("reads GitHub Actions green-rate", async () => {
    const github = {
      requestJson: async () => ({
        data: {
          workflow_runs: Array.from({ length: 30 }, (_unused, index) => ({
            conclusion: index < 24 ? "success" : "failure",
          })),
        },
        headers: new Headers(),
      }),
    } as unknown as GitHubClient;

    await expect(readCiGreenRate30d("C:/repo", { github })).resolves.toBe(80);
  });

  it("returns null when local git has no CI signal", async () => {
    await expect(readCiGreenRate30d(makeRepo())).resolves.toBeNull();
  });
});
