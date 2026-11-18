export type TimeRangeOption = "24H" | "7D" | "30D";

export interface EngineHealthDto {
  status: "ONLINE" | "STANDBY" | string;
  appName: string;
  version: string;
  latencyMs: number;
  message: string;
}

export interface EnginePipelineStatsDto {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  recordsProcessed: number;
  lastRunAt?: string | null;
  changeVsPrevious?: {
    totalRuns?: number;
    successRate?: number;
    avgDuration?: number;
    recordsProcessed?: number;
  } | null;
}

export interface EngineDataQualityDto {
  overallScore: number;
  completeness: number;
  uniqueness: number;
  consistency: number;
  timeliness: number;
}

export interface EngineEntityStatsDto {
  totalGoldenRecords?: number;
  totalStagingRecords?: number;
  pendingERCandidates?: number;
  entityTypeBreakdown?: Record<string, number>;
}

export interface EngineMetricsPayload {
  engineHealth?: EngineHealthDto;
  pipelineStats?: EnginePipelineStatsDto;
  dataQuality?: EngineDataQualityDto;
  entityStats?: EngineEntityStatsDto;
}

export interface PipelineSummaryMetricsDto {
  totalRecordsCleaned: number;
  totalEntitiesResolved: number;
  activeJobsCount: number;
  totalFailedRecords: number;
  totalRunsCount: number;
}

export interface TimeSeriesPoint {
  date: string;
  entityCount: number;
  pipelineRuns: number;
}

export interface PipelineRunItem {
  id: string;
  connectionId?: string;
  connectorName: string;
  connectorType: string;
  pipelineType: string;
  status: "RUNNING" | "CLEANED" | "COMPLETED" | "FAILED" | string;
  progress: number;
  recordsInput: number;
  recordsOutput: number;
  recordsFailed: number;
  throughput: number;
  startedAt: string;
  completedAt?: string | null;
  durationSeconds: number;
  errorMessage?: string | null;
  metadata?: string | null;
  createdAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface StageMetric {
  stage: "ingest" | "clean" | "dedupe" | "resolve";
  label: string;
  recordsIn: number;
  recordsOut: number;
  dropped: number;
  durationSeconds: number;
  isSlowest?: boolean;
  isHighestDrop?: boolean;
}

export interface RejectionReasonItem {
  reason: string;
  count: number;
  lastOccurredAt?: string;
}

export interface FailingPipelineItem {
  pipelineId: string;
  pipelineName: string;
  failureCount: number;
  lastError?: string;
  lastRunId?: string;
}

export interface EngineJobDetail {
  run_id: string;
  status: string;
  progress_pct: number;
  message?: string;
  current_step?: string;
  steps_completed?: string[];
  total_steps?: number;
  error?: string | null;
  started_at?: string;
  completed_at?: string | null;
  dagster_run_id?: string | null;
  retry_count?: number;
  failed_step?: string | null;
  error_history?: Array<{
    step?: string;
    error?: string;
    timestamp?: string;
    retry_count?: number;
  }>;
  logs?: string[];
  quality_scores?: {
    completeness?: number;
    uniqueness?: number;
    consistency?: number;
    timeliness?: number;
  };
}
