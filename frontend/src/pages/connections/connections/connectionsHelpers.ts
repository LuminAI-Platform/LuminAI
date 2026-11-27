import type {
  IngestedFile,
  DatabaseConnector,
  SourceStatus,
  UnifiedSource,
  ConnectionsTab,
} from "./connectionsTypes";

export function normalizeSourceStatus(rawStatus: unknown): SourceStatus {
  const s = String(rawStatus ?? "ACTIVE").toUpperCase();
  if (s === "INACTIVE" || s === "PAUSED") return "Paused";
  if (s === "ERROR" || s === "FAILED") return "Failed";
  if (s === "SYNCING" || s === "RUNNING" || s === "PENDING") return "Syncing";
  return "Connected";
}

export function formatConnectorTypeLabel(rawType: string): string {
  const upper = rawType.toUpperCase();
  if (upper === "POSTGRESQL" || upper === "POSTGRES") return "PostgreSQL";
  if (upper === "MYSQL") return "MySQL";
  if (upper === "MSSQL" || upper === "SQLSERVER") return "SQL Server";
  if (upper === "SNOWFLAKE") return "Snowflake";
  if (upper === "CLICKHOUSE") return "ClickHouse";
  if (upper === "API") return "API";
  if (upper === "FILE") return "Flat file";
  return rawType || "Database";
}

function extractSchemaDrift(
  item: Record<string, unknown>,
  parsedConfig: Record<string, unknown>,
): string | undefined {
  const drift = item.schemaDrift ?? parsedConfig.schemaDrift;
  if (typeof drift === "string" && drift.trim().length > 0) return drift.trim();
  if (drift === true) return "Schema drift detected";
  return undefined;
}

export function parseRawConnections(data: unknown[]): {
  fileItems: IngestedFile[];
  dbItems: DatabaseConnector[];
} {
  const fileItems: IngestedFile[] = [];
  const dbItems: DatabaseConnector[] = [];

  (data as Record<string, unknown>[]).forEach(
    (item: Record<string, unknown>) => {
      let parsedConfig: Record<string, unknown> = {};
      if (typeof item.config === "string") {
        try {
          parsedConfig = JSON.parse(item.config);
        } catch {
          // ignore
        }
      } else if (item.config && typeof item.config === "object") {
        parsedConfig = item.config as Record<string, unknown>;
      }

      const lastSyncIso =
        typeof item.lastSyncAt === "string"
          ? item.lastSyncAt
          : typeof item.updatedAt === "string"
            ? item.updatedAt
            : typeof item.createdAt === "string"
              ? item.createdAt
              : undefined;

      const schemaDriftWarning = extractSchemaDrift(item, parsedConfig);

      if (String(item.type || "").toUpperCase() === "FILE") {
        let sizeDisplay = "—";
        if (typeof parsedConfig.fileSize === "number") {
          sizeDisplay = `${(Number(parsedConfig.fileSize) / (1024 * 1024)).toFixed(2)} MB`;
        } else if (typeof parsedConfig.fileSize === "string") {
          sizeDisplay = parsedConfig.fileSize;
        }

        const rawRowCount =
          parsedConfig.rowsCount ??
          parsedConfig.recordsCount ??
          parsedConfig.rows;
        const rowCount =
          rawRowCount !== undefined && rawRowCount !== null
            ? Number(rawRowCount)
            : 0;

        fileItems.push({
          id: String(item.id || Math.random().toString(36).substring(7)),
          name: String(item.name || parsedConfig.fileName || "File ingestion"),
          fileName:
            typeof parsedConfig.fileName === "string"
              ? parsedConfig.fileName
              : undefined,
          size: sizeDisplay,
          recordsCount: isNaN(rowCount) ? 0 : rowCount,
          status: normalizeSourceStatus(item.status),
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : new Date().toISOString(),
          lastSyncedAt: lastSyncIso,
          schemaDriftWarning,
          columns: Array.isArray(parsedConfig.columns)
            ? (parsedConfig.columns as string[])
            : undefined,
          sampleRows: Array.isArray(parsedConfig.sampleRows)
            ? (parsedConfig.sampleRows as Record<string, unknown>[])
            : undefined,
        });
      } else {
        let configuredPipelines: number | undefined;
        let configDesc = "";
        if (Array.isArray(parsedConfig.tables)) {
          configuredPipelines = parsedConfig.tables.length;
        } else if (Array.isArray(parsedConfig.selectedTables)) {
          configuredPipelines = parsedConfig.selectedTables.length;
        }
        if (parsedConfig.database) {
          configDesc = `Database: ${String(parsedConfig.database)}`;
        }
        const host =
          typeof parsedConfig.host === "string" && parsedConfig.host.trim()
            ? parsedConfig.host.trim()
            : undefined;

        const rawRows =
          parsedConfig.rowsSynced ??
          parsedConfig.recordsCount ??
          item.rowsSynced;
        const rowsSynced =
          typeof rawRows === "number" && !isNaN(rawRows) ? rawRows : undefined;

        dbItems.push({
          id: typeof item.id === "string" ? item.id : undefined,
          name: String(item.name || ""),
          status: normalizeSourceStatus(item.status),
          pipelines: configuredPipelines || 1,
          configuredPipelines,
          type: String(item.type || "POSTGRESQL"),
          desc:
            configDesc ||
            (typeof item.credentialsRef === "string"
              ? item.credentialsRef
              : "Registered database connector"),
          host,
          createdAt:
            typeof item.createdAt === "string" ? item.createdAt : undefined,
          lastSyncedAt: lastSyncIso,
          rowsSynced,
          schemaDriftWarning,
        });
      }
    },
  );

  return { fileItems, dbItems };
}

export function buildUnifiedSources(
  dbItems: DatabaseConnector[],
  fileItems: IngestedFile[],
): UnifiedSource[] {
  const dbSources: UnifiedSource[] = dbItems.map((c, idx) => ({
    id: c.id ?? `db-${c.name}-${idx}`,
    name: c.name,
    category: "database",
    typeLabel: formatConnectorTypeLabel(c.type),
    rawType: c.type,
    status: normalizeSourceStatus(c.status),
    createdAt: c.createdAt,
    lastSyncAt: c.lastSyncedAt,
    rowsSynced: c.rowsSynced,
    schemaDriftWarning: c.schemaDriftWarning,
    host: c.host,
    desc: c.desc,
    pipelines: c.pipelines,
    configuredPipelines: c.configuredPipelines,
    connectorRef: c,
  }));

  const fileSources: UnifiedSource[] = fileItems.map((f) => ({
    id: f.id,
    name: f.name,
    category: "file",
    typeLabel: "Flat file",
    rawType: "FILE",
    status: normalizeSourceStatus(f.status),
    createdAt: f.createdAt,
    lastSyncAt: f.lastSyncedAt ?? f.createdAt,
    rowsSynced: f.recordsCount,
    schemaDriftWarning: f.schemaDriftWarning,
    fileName: f.fileName,
    size: f.size,
    fileRef: f,
  }));

  return [...dbSources, ...fileSources];
}

export const CONNECTIONS_TAB_STORAGE_KEY = "luminai_connections_tab";

export function isValidConnectionsTab(
  value: string | null | undefined,
): value is ConnectionsTab {
  return value === "all" || value === "connectors" || value === "files";
}

/**
 * Resolves the active tab after data loads so the page never opens on an
 * empty tab when another tab has items.
 */
export function resolveNonEmptyTab(
  currentTab: ConnectionsTab,
  counts: { connectors: number; files: number },
): ConnectionsTab {
  const total = counts.connectors + counts.files;
  if (total === 0) return currentTab;

  if (currentTab === "connectors" && counts.connectors === 0) {
    return "all";
  }
  if (currentTab === "files" && counts.files === 0) {
    return "all";
  }
  return currentTab;
}
