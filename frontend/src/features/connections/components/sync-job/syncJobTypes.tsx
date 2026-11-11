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

export const STATUS_CONFIG: Record<
  SyncJobStatus,
  { label: string; dot: string; badge: string; text: string }
> = {
  running: {
    label: "Syncing",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
  },
  paused: {
    label: "Paused",
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 text-amber-400 border-amber-400/30",
    text: "text-amber-400",
  },
  completed: {
    label: "Completed",
    dot: "bg-blue-400",
    badge: "bg-blue-400/10 text-blue-400 border-blue-400/30",
    text: "text-blue-400",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-400",
    badge: "bg-red-400/10 text-red-400 border-red-400/30",
    text: "text-red-400",
  },
};
