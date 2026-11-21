import type {
  DashboardSummary,
  EngineMetricsResponse,
} from "../pages/dashboard/useDashboardData";

export const makeEngineMetrics = (
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

export const makeDashboardSummary = (
  overrides?: Partial<DashboardSummary>,
): DashboardSummary => ({
  totalEntities: 0,
  totalConnections: 0,
  totalPipelines: 0,
  entityBreakdown: {},
  recentActivity: [],
  dataQualityScore: 100.0,
  pipelineHealth: { running: 0, completed: 0, failed: 0 },
  lastSyncAt: null,
  ...overrides,
});
