import type { PipelineRunItem } from "../pipeline-analysis/pipelineAnalysisTypes";

export type SyncJobStatus =
  | "running"
  | "paused"
  | "completed"
  | "completed_with_issues"
  | "failed";

export type SyncSourceType = "File" | "Database" | "API";

export interface SyncDataset {
  id: string;
  connectionId?: string;
  name: string;
  fileName?: string;
  pipelineTypeLabel?: string;
  sourceType: SyncSourceType;
  rawConnectorType: string;
  totalRecords?: number;
  syncedRecords?: number;
  rejectedRecords?: number;
  quarantinedRecords?: number;
  status: SyncJobStatus;
  rawStatus: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationSeconds?: number;
  throughput?: number;
  errorMessage?: string | null;
  metadata?: string | null;
  rawRun?: PipelineRunItem;
}

export interface SyncJob {
  id: string;
  name: string;
  connection: string;
  connectionType:
    | "postgresql"
    | "mysql"
    | "snowflake"
    | "kafka"
    | "s3"
    | "file";
  status: SyncJobStatus;
  datasets: SyncDataset[];
  startedAt: Date;
  estimatedEnd?: Date;
}

/**
 * Semantic design system tokens for sync statuses:
 * - Completed -> success
 * - Completed with issues -> warning (amber)
 * - Syncing -> primary/warning
 * - Paused -> nodata
 * - Failed -> error
 */
export const STATUS_CONFIG: Record<
  SyncJobStatus,
  { label: string; dot: string; badge: string; text: string; bar: string }
> = {
  running: {
    label: "Syncing",
    dot: "bg-primary",
    badge: "bg-primary-tint text-primary border-primary-border font-medium",
    text: "text-primary",
    bar: "bg-primary",
  },
  paused: {
    label: "Paused",
    dot: "bg-nodata",
    badge: "bg-nodata-bg text-nodata border-nodata-border font-medium",
    text: "text-nodata",
    bar: "bg-nodata",
  },
  completed: {
    label: "Completed",
    dot: "bg-success",
    badge: "bg-success-bg text-success border-success-border font-medium",
    text: "text-success",
    bar: "bg-success",
  },
  completed_with_issues: {
    label: "Completed with issues",
    dot: "bg-warning",
    badge: "bg-warning-bg text-warning border-warning-border font-medium",
    text: "text-warning",
    bar: "bg-warning",
  },
  failed: {
    label: "Failed",
    dot: "bg-error",
    badge: "bg-error-bg text-error border-error-border font-medium",
    text: "text-error",
    bar: "bg-error",
  },
};
