import type { ActivityItem } from "./components/ActivityFeed";

export interface DashboardSummary {
  totalEntities: number;
  totalConnections: number;
  totalPipelines: number;
  entityBreakdown: Record<string, number>;
  recentActivity: ActivityItem[];
  dataQualityScore: number | null;
  pipelineHealth: {
    running: number;
    completed: number;
    failed: number;
  };
  lastSyncAt: string | null;
}

export interface EngineHealth {
  status: "ONLINE" | "STANDBY" | "DEGRADED" | string;
  appName: string;
  version: string;
  latencyMs: number;
  message: string;
}

export interface PipelineStats {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  p95Duration?: number;
  recordsProcessed: number;
  runsSinceStart?: number;
  lastRunAt?: string;
  quarantinedCount?: number;
  rejectedCount?: number;
  evaluatedCount?: number;
}

export interface DataQuality {
  overallScore?: number | null;
  completeness?: number | null;
  uniqueness?: number | null;
  consistency?: number | null;
  timeliness?: number | null;
  recordsEvaluated?: number;
  recordsRejected?: number;
  recordsQuarantined?: number;
  available?: boolean;
  status?: string;
  error?: string;
}

export interface EntityStats {
  totalEntities?: number;
  totalGoldenRecords?: number;
  totalStagingRecords?: number;
}

export interface EngineMetricsResponse {
  engineHealth?: EngineHealth;
  pipelineStats?: PipelineStats;
  dataQuality?: DataQuality;
  entityStats?: EntityStats;
}

export interface SyncDiscrepancy {
  runsMismatch: boolean;
  entitiesMismatch: boolean;
  message?: string;
}

export function computeSyncDiscrepancy(
  summary: DashboardSummary | undefined,
  engineMetrics: EngineMetricsResponse | undefined,
): SyncDiscrepancy {
  const summaryPipelines = summary?.totalPipelines;
  const engineRuns = engineMetrics?.pipelineStats?.totalRuns;
  const runsMismatch =
    summaryPipelines !== undefined &&
    engineRuns !== undefined &&
    summaryPipelines !== engineRuns;

  const summaryEntities = summary?.totalEntities;
  const engineEntities =
    engineMetrics?.entityStats?.totalEntities ??
    engineMetrics?.entityStats?.totalGoldenRecords;
  const entitiesMismatch =
    summaryEntities !== undefined &&
    engineEntities !== undefined &&
    summaryEntities !== engineEntities;

  let message: string | undefined;
  if (runsMismatch && entitiesMismatch) {
    message = `Runs (${summaryPipelines} platform vs ${engineRuns} engine) and entities (${summaryEntities} vs ${engineEntities}) are out of sync.`;
  } else if (runsMismatch) {
    message = `Platform history reports ${summaryPipelines} runs, while engine live telemetry reports ${engineRuns} runs.`;
  } else if (entitiesMismatch) {
    message = `Platform reports ${summaryEntities} entities, while engine reports ${engineEntities} entities.`;
  }

  return {
    runsMismatch,
    entitiesMismatch,
    message,
  };
}
