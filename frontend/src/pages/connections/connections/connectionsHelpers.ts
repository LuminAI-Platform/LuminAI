import type { IngestedFile, DatabaseConnector } from "./connectionsTypes";

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

      if (String(item.type || "").toUpperCase() === "FILE") {
        let sizeDisplay = "1.2 MB";
        if (typeof parsedConfig.fileSize === "number") {
          sizeDisplay = `${(Number(parsedConfig.fileSize) / (1024 * 1024)).toFixed(2)} MB`;
        } else if (typeof parsedConfig.fileSize === "string") {
          sizeDisplay = parsedConfig.fileSize;
        }

        const rowCount = Number(
          parsedConfig.rowsCount ??
            parsedConfig.recordsCount ??
            parsedConfig.rows ??
            0,
        );

        fileItems.push({
          id: String(item.id || Math.random().toString(36).substring(7)),
          name: String(item.name || parsedConfig.fileName || "File Ingestion"),
          size: sizeDisplay,
          recordsCount: rowCount,
          status: item.status === "FAILED" ? "Failed" : "Synced",
          createdAt:
            typeof item.createdAt === "string"
              ? new Date(item.createdAt).toLocaleString()
              : new Date().toLocaleString(),
          columns: Array.isArray(parsedConfig.columns)
            ? (parsedConfig.columns as string[])
            : undefined,
          sampleRows: Array.isArray(parsedConfig.sampleRows)
            ? (parsedConfig.sampleRows as Record<string, unknown>[])
            : undefined,
        });
      } else {
        let pipelinesCount = 0;
        let configDesc = "";
        if (Array.isArray(parsedConfig.selectedTables)) {
          pipelinesCount = parsedConfig.selectedTables.length;
        }
        if (parsedConfig.database) {
          configDesc = `Connected to ${parsedConfig.database} database.`;
        }

        const rawStatus = String(item.status || "ACTIVE");
        const normalizedStatus =
          rawStatus === "ACTIVE" || rawStatus === "CONNECTED"
            ? "Connected"
            : rawStatus === "SYNCING"
              ? "Syncing"
              : rawStatus === "FAILED"
                ? "Failed"
                : rawStatus;

        dbItems.push({
          id: typeof item.id === "string" ? item.id : undefined,
          name: String(item.name || ""),
          status: normalizedStatus,
          pipelines: pipelinesCount || 1,
          type: String(item.type || "Database"),
          desc:
            configDesc ||
            (typeof item.credentialsRef === "string"
              ? item.credentialsRef
              : "Registered database pipeline connector."),
          lastSyncedAt:
            typeof item.updatedAt === "string" ? item.updatedAt : undefined,
        });
      }
    },
  );

  return { fileItems, dbItems };
}
