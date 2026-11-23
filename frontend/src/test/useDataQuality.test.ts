import { describe, it, expect } from "vitest";
import {
  computeDataQuality,
  formatQualityMetric,
} from "../hooks/useDataQuality";
import type { EngineMetricsResponse } from "../pages/dashboard/dashboardTypes";

const makeEngineMetrics = (
  completeness: number | null | undefined,
  uniqueness: number | null | undefined,
  consistency: number | null | undefined,
  timeliness: number | null | undefined,
  extra?: Partial<EngineMetricsResponse>,
): EngineMetricsResponse => ({
  engineHealth: {
    status: "ONLINE",
    appName: "LuminAI Data Engine",
    version: "0.1.0",
    latencyMs: 7,
    message: "Data Engine reachable",
  },
  pipelineStats: {
    totalRuns: 10,
    successRate: 100,
    avgDuration: 2.1,
    recordsProcessed: 1000,
  },
  dataQuality: {
    completeness,
    uniqueness,
    consistency,
    timeliness,
    recordsEvaluated: 1000,
  },
  ...extra,
});

describe("useDataQuality / computeDataQuality", () => {
  it("computes the average of all four finite dimensions", () => {
    const res = computeDataQuality(makeEngineMetrics(100, 90, 80, 70));
    expect(res.score).toBe(85);
    expect(res.isComplete).toBe(true);
    expect(formatQualityMetric(res.score)).toBe("85.0%");
  });

  it("handles fractional percentages precisely", () => {
    const res = computeDataQuality(makeEngineMetrics(99.4, 98.2, 97.1, 95.0));
    expect(res.score).toBeCloseTo(97.425, 3);
    expect(formatQualityMetric(res.score)).toBe("97.4%");
  });

  it("marks isComplete false when some dimensions are null or undefined", () => {
    const res = computeDataQuality(makeEngineMetrics(90, null, 80, undefined));
    expect(res.score).toBeNull();
    expect(res.isComplete).toBe(false);
  });

  it("returns null score when all dimensions are missing", () => {
    const res = computeDataQuality(
      makeEngineMetrics(null, undefined, null, null),
    );
    expect(res.score).toBeNull();
    expect(res.isComplete).toBe(false);
    expect(formatQualityMetric(res.score)).toBe("N/A");
  });

  it("rejects zero-stubbed default metrics where all dimensions are identically 0 with 0 evaluated records", () => {
    const res = computeDataQuality(
      makeEngineMetrics(0, 0, 0, 0, {
        dataQuality: {
          overallScore: 0,
          completeness: 0,
          uniqueness: 0,
          consistency: 0,
          timeliness: 0,
          recordsEvaluated: 0,
        },
      }),
    );
    expect(res.score).toBeNull();
    expect(res.isComplete).toBe(false);
    expect(formatQualityMetric(res.score)).toBe("N/A");
  });

  it("treats measured real 0% as valid when recordsEvaluated > 0", () => {
    const res = computeDataQuality(
      makeEngineMetrics(0, 0, 0, 0, {
        dataQuality: {
          completeness: 0,
          uniqueness: 0,
          consistency: 0,
          timeliness: 0,
          recordsEvaluated: 500,
        },
      }),
    );
    expect(res.score).toBe(0);
    expect(res.isComplete).toBe(true);
    expect(formatQualityMetric(res.score)).toBe("0.0%");
  });
});
