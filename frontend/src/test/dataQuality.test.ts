import { describe, it, expect } from "vitest";
import {
  computeDataQuality,
  formatQualityMetric,
} from "../hooks/useDataQuality";
import { makeEngineMetrics } from "./dashboardKpiFixtures";

describe("useDataQuality / computeDataQuality", () => {
  it("computes the average of all four finite dimensions", () => {
    const res = computeDataQuality(makeEngineMetrics(100, 90, 80, 70));
    expect(res.score).toBe(85);
    expect(res.isComplete).toBe(true);
    expect(formatQualityMetric(res.score)).toBe("85.0%");
  });

  it("returns null score when any dimension is null, undefined, or NaN", () => {
    expect(
      computeDataQuality(makeEngineMetrics(90, null, 80, 70)).score,
    ).toBeNull();
    expect(
      computeDataQuality(makeEngineMetrics(90, 80, undefined, 70)).score,
    ).toBeNull();
    expect(
      computeDataQuality(makeEngineMetrics(90, 80, 70, Number.NaN)).score,
    ).toBeNull();
  });

  it("treats missing engine response or available: false fallback zeros as unavailable (N/A)", () => {
    expect(computeDataQuality(undefined).score).toBeNull();
    expect(
      computeDataQuality({
        engineHealth: {
          status: "STANDBY",
          appName: "LuminAI Data Engine",
          version: "unknown",
          latencyMs: 3000,
          message: "Unreachable",
        },
        dataQuality: {
          overallScore: 0,
          completeness: 0,
          uniqueness: 0,
          consistency: 0,
          timeliness: 0,
          available: false,
          status: "UNAVAILABLE",
        },
      }).score,
    ).toBeNull();
    expect(formatQualityMetric(null)).toBe("N/A");
  });

  it("preserves a real measured 0 and formats it as 0.0%", () => {
    const res = computeDataQuality(makeEngineMetrics(0, 0, 0, 0));
    expect(res.score).toBe(0);
    expect(res.isComplete).toBe(true);
    expect(formatQualityMetric(res.score)).toBe("0.0%");
  });
});
