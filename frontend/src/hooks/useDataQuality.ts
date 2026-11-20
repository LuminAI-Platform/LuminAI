import { useMemo } from "react";
import type { EngineMetricsResponse } from "../pages/dashboard/useDashboardData";

export interface DataQualityDimensions {
  completeness: number | null;
  uniqueness: number | null;
  consistency: number | null;
  timeliness: number | null;
}

export interface DataQualityResult {
  /** Average of all four dimensions when all four are available finite numbers; otherwise null. */
  score: number | null;
  dimensions: DataQualityDimensions;
  /** True only when all four quality dimensions are available finite numbers. */
  isComplete: boolean;
  /** True when at least one quality dimension has a real measured value. */
  hasAnyMetric: boolean;
  recordsEvaluated: number | null;
  recordsQuarantined: number;
  recordsRejected: number;
}

/**
 * A metric is available only if it is a finite number.
 * null, undefined, NaN, Infinity, or missing engine responses are unavailable.
 */
export function isAvailableMetric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Formats a quality metric percentage, distinguishing a real measured 0 (0.0%)
 * from unavailable/missing data ("N/A").
 */
export function formatQualityMetric(value: number | null): string {
  if (!isAvailableMetric(value)) {
    return "N/A";
  }
  return `${value.toFixed(1)}%`;
}

/**
 * Pure computation of overall Data Quality Score and dimension breakdown
 * from the Processing Engine metrics object.
 *
 * Rules:
 * - Never defaults to 100.
 * - Never renders missing/unavailable data as 0.0%.
 * - A real measured 0 is preserved and formatted as 0.0%.
 * - If all four dimensions are available finite numbers, score = average of the four.
 * - If any dimension is unavailable, score = null (card displays "N/A" + "Unverified").
 */
export function computeDataQuality(
  engineMetrics?: EngineMetricsResponse | null,
): DataQualityResult {
  const emptyResult: DataQualityResult = {
    score: null,
    dimensions: {
      completeness: null,
      uniqueness: null,
      consistency: null,
      timeliness: null,
    },
    isComplete: false,
    hasAnyMetric: false,
    recordsEvaluated: null,
    recordsQuarantined: 0,
    recordsRejected: 0,
  };

  if (!engineMetrics?.dataQuality) {
    return emptyResult;
  }

  const dq = engineMetrics.dataQuality;
  const stats = engineMetrics.pipelineStats;
  const healthStatus = engineMetrics.engineHealth?.status?.toUpperCase();

  const recordsQuarantined =
    dq.recordsQuarantined ?? stats?.quarantinedCount ?? 0;
  const recordsRejected = dq.recordsRejected ?? stats?.rejectedCount ?? 0;
  const rawEvaluated = dq.recordsEvaluated ?? stats?.evaluatedCount;
  const recordsEvaluated =
    typeof rawEvaluated === "number" && Number.isFinite(rawEvaluated)
      ? rawEvaluated
      : null;

  // Treat engine fallback / unavailable responses as missing data
  if (
    dq.available === false ||
    dq.status?.toUpperCase() === "UNAVAILABLE" ||
    (healthStatus !== undefined &&
      healthStatus !== "ONLINE" &&
      healthStatus !== "DEGRADED")
  ) {
    return {
      ...emptyResult,
      recordsQuarantined,
      recordsRejected,
    };
  }

  // Explicitly 0 evaluated records means no quality measurement was taken
  if (recordsEvaluated === 0) {
    return {
      ...emptyResult,
      recordsEvaluated: 0,
      recordsQuarantined,
      recordsRejected,
    };
  }

  // Python Data Engine returns all-zero stub when 0 live runs & no evaluated records exist
  const isEmptyEngineZeroStub =
    stats?.totalRuns === 0 &&
    recordsEvaluated === null &&
    dq.completeness === 0 &&
    dq.uniqueness === 0 &&
    dq.consistency === 0 &&
    dq.timeliness === 0;

  if (isEmptyEngineZeroStub) {
    return {
      ...emptyResult,
      recordsQuarantined,
      recordsRejected,
    };
  }

  const completeness = isAvailableMetric(dq.completeness)
    ? dq.completeness
    : null;
  const uniqueness = isAvailableMetric(dq.uniqueness) ? dq.uniqueness : null;
  const consistency = isAvailableMetric(dq.consistency) ? dq.consistency : null;
  const timeliness = isAvailableMetric(dq.timeliness) ? dq.timeliness : null;

  const isComplete =
    completeness !== null &&
    uniqueness !== null &&
    consistency !== null &&
    timeliness !== null;

  const hasAnyMetric =
    completeness !== null ||
    uniqueness !== null ||
    consistency !== null ||
    timeliness !== null;

  const score = isComplete
    ? (completeness + uniqueness + consistency + timeliness) / 4
    : null;

  return {
    score,
    dimensions: {
      completeness,
      uniqueness,
      consistency,
      timeliness,
    },
    isComplete,
    hasAnyMetric,
    recordsEvaluated,
    recordsQuarantined,
    recordsRejected,
  };
}

/**
 * Shared hook so the Dashboard KPI card and the Pipeline Monitor quality breakdown
 * derive from the exact same metrics object and cannot disagree.
 */
export function useDataQuality(
  engineMetrics?: EngineMetricsResponse | null,
): DataQualityResult {
  return useMemo(() => computeDataQuality(engineMetrics), [engineMetrics]);
}
