import type { TimeSeriesPoint } from "./components/PipelineTimelineChart";
import type { ActivityItem } from "./components/ActivityFeed";

export type { TimeSeriesPoint, ActivityItem };

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
