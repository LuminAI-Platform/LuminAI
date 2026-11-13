import React from "react";

export type SyncJobStatus = "running" | "paused" | "completed" | "failed";

export interface SyncDataset {
  id: string;
  name: string;
  source: string;
  totalRecords: number;
  syncedRecords: number;
  failedRecords: number;
  status: SyncJobStatus;
  startedAt: Date;
}

export interface SyncJob {
  id: string;
  name: string;
  connection: string;
  connectionType: "postgresql" | "mysql" | "snowflake" | "kafka" | "s3";
  status: SyncJobStatus;
  datasets: SyncDataset[];
  startedAt: Date;
  estimatedEnd?: Date;
}

export const SOURCE_ICONS: Record<SyncJob["connectionType"], React.ReactNode> =
  {
    postgresql: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
        <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
      </svg>
    ),
    mysql: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      </svg>
    ),
    snowflake: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="m20 10-8-8-8 8" />
        <path d="m4 14 8 8 8-8" />
        <path d="m2 12 10 0m0 0 10 0" />
        <path d="m6 8 2 2m8-2-2 2M6 16l2-2m8 2-2-2" />
      </svg>
    ),
    kafka: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      </svg>
    ),
    s3: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  };

/**
 * Status colors using semantic design system tokens:
 * - Completed / Active / Connected -> success
 * - Running / Syncing -> warning
 * - Paused -> nodata
 * - Failed -> error
 */
export const STATUS_CONFIG: Record<
  SyncJobStatus,
  { label: string; dot: string; badge: string; text: string }
> = {
  running: {
    label: "Syncing",
    dot: "bg-warning",
    badge: "bg-warning-bg text-warning border-warning-border font-medium",
    text: "text-warning",
  },
  paused: {
    label: "Paused",
    dot: "bg-nodata",
    badge: "bg-nodata-bg text-nodata border-nodata-border font-medium",
    text: "text-nodata",
  },
  completed: {
    label: "Completed",
    dot: "bg-success",
    badge: "bg-success-bg text-success border-success-border font-medium",
    text: "text-success",
  },
  failed: {
    label: "Failed",
    dot: "bg-error",
    badge: "bg-error-bg text-error border-error-border font-medium",
    text: "text-error",
  },
};
