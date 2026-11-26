export type ConnectionsTab = "all" | "connectors" | "files";

export type SourceStatus = "Connected" | "Syncing" | "Failed" | "Paused";

export interface IngestedFile {
  id: string;
  name: string;
  fileName?: string;
  size: string;
  recordsCount: number;
  status: SourceStatus | "Synced";
  createdAt: string;
  lastSyncedAt?: string;
  schemaDriftWarning?: string;
  columns?: string[];
  sampleRows?: Record<string, unknown>[];
}

export interface CleanDataResponse {
  connectionId: string;
  totalRawRecords: number;
  totalCleanRecords: number;
  duplicatesMerged: number;
  compressionRatio: string;
  dataQualityScore: number;
  status: string;
  columns: string[];
  rows: Record<string, unknown>[];
  verifiedRecords?: number;
  needsReviewRecords?: number;
  rejectedRecords?: number;
  qualityBreakdown?: Record<string, number>;
  profilingDelta?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    improvements?: string[];
  };
}

export interface DatabaseConnector {
  id?: string;
  name: string;
  status: SourceStatus | string;
  pipelines: number;
  configuredPipelines?: number;
  type: string;
  desc: string;
  host?: string;
  createdAt?: string;
  lastSyncedAt?: string;
  rowsSynced?: number;
  schemaDriftWarning?: string;
}

export interface UnifiedSource {
  id: string;
  name: string;
  category: "database" | "file";
  typeLabel: string;
  rawType: string;
  status: SourceStatus;
  createdAt?: string;
  lastSyncAt?: string;
  rowsSynced?: number;
  schemaDriftWarning?: string;
  host?: string;
  fileName?: string;
  desc?: string;
  size?: string;
  pipelines?: number;
  configuredPipelines?: number;
  fileRef?: IngestedFile;
  connectorRef?: DatabaseConnector;
}

export {
  formatRelativeTime,
  formatExactTimestamp,
  formatTimeAgo,
  getHealthStatusBadge,
  formatColumnHeader,
  formatCellValue,
  renderCleanCellValue,
} from "./connectionsFormatters";
