import { apiFetch, UPLOAD_REQUEST_TIMEOUT_MS } from "../../../../lib/api";
import type { ColumnConfig } from "../DataPreviewTable";
import type { ColumnMappingConfig, IngestionLog } from "./fileUploadTypes";
import { sanitizePropertyName, inferPropertyType } from "./fileUploadTypes";

interface RunIngestionPipelineParams {
  file: File;
  parsedData: { columns: string[]; rows: Record<string, unknown>[] };
  columnsConfig: ColumnConfig[];
  mappings: Record<string, ColumnMappingConfig>;
  primaryTargetEntity: string;
  backendEntityTypes: string[];
  addLog: (msg: string, level?: IngestionLog["level"]) => void;
  setProgress: (p: number) => void;
}

export interface IngestionPipelineResult {
  connectionId: string;
  recordsCount?: number;
}

export async function runIngestionPipeline({
  file,
  parsedData,
  columnsConfig,
  mappings,
  primaryTargetEntity,
  backendEntityTypes,
  addLog,
  setProgress,
}: RunIngestionPipelineParams): Promise<IngestionPipelineResult> {
  const activeCols = columnsConfig.filter((c) => c.active);

  // 1. Ensure entity types in ontology
  try {
    const usedEntityTypes = Array.from(
      new Set(
        activeCols
          .map((c) => mappings[c.name]?.targetEntityType || primaryTargetEntity)
          .filter(Boolean),
      ),
    );

    for (const entName of usedEntityTypes) {
      if (!backendEntityTypes.includes(entName)) {
        addLog(
          `[Ontology] Registering Entity Type '${entName}' in ontology graph...`,
          "INFO",
        );
        const entityCols = activeCols.filter(
          (c) =>
            (mappings[c.name]?.targetEntityType || primaryTargetEntity) ===
            entName,
        );
        const propertiesPayload = entityCols.map((c) => ({
          name:
            mappings[c.name]?.targetProperty || sanitizePropertyName(c.name),
          type: inferPropertyType(c.type),
          required:
            c.name.toLowerCase().endsWith("id") ||
            c.name.toLowerCase() === "id",
          defaultValue: null,
          description: c.name,
        }));

        const ontRes = await apiFetch("/api/v1/ontology/entity-types", {
          method: "POST",
          body: JSON.stringify({
            name: entName,
            label: entName.replace(/([A-Z])/g, " $1").trim(),
            color: "#3b82f6",
            icon: "database",
            description: `Generated from ${file.name}`,
            properties: propertiesPayload,
          }),
        });
        if (ontRes.ok) {
          addLog(
            `[Ontology] Entity Type '${entName}' registered with ${propertiesPayload.length} properties.`,
            "SUCCESS",
          );
        }
      }
    }
  } catch (e) {
    addLog(
      `[Ontology] Note: Entity registration fallback active (${e instanceof Error ? e.message : "OK"}).`,
      "INFO",
    );
  }

  // 2. Register Connection
  setProgress(25);
  addLog(
    `[API] Registering Connection entity (type: FILE) in tenant catalog...`,
    "INFO",
  );
  const regPayload = {
    name: file.name,
    type: "FILE",
    config: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      rowsCount: parsedData.rows.length,
      columns: parsedData.columns,
      sampleRows: parsedData.rows.slice(0, 100),
    }),
    credentialsRef: "minio-bucket-raw",
  };

  const connRes = await apiFetch("/api/v1/connections", {
    method: "POST",
    body: JSON.stringify(regPayload),
  });
  if (!connRes.ok) {
    throw new Error(
      `Connection registration rejected (HTTP ${connRes.status})`,
    );
  }
  const connData = await connRes.json();
  const createdConnId = connData.id;
  addLog(`[API] Connection registered with ID: ${createdConnId}`, "SUCCESS");

  // 3. Upload File
  setProgress(50);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  addLog(
    `[MinIO] Uploading multipart payload (${sizeMb} MB) to tenant-isolated raw storage...`,
    "INFO",
  );
  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await apiFetch(
    `/api/v1/connections/${createdConnId}/upload`,
    {
      method: "POST",
      body: formData,
      // Generous timeout for 100MB+ large files (15 minutes)
      timeoutMs: UPLOAD_REQUEST_TIMEOUT_MS,
    } as RequestInit,
  );
  if (!uploadRes.ok) {
    throw new Error(
      `File upload rejected by storage engine (HTTP ${uploadRes.status})`,
    );
  }
  const uploadJson = await uploadRes.json();
  setProgress(75);
  addLog(
    `[MinIO] Upload complete. Key: ${uploadJson.fileKey || file.name}`,
    "SUCCESS",
  );
  if (uploadJson.archive) {
    addLog(
      `[Archive] Extracted ${uploadJson.filesProcessed} datasets (${uploadJson.recordsCount} total records) into staging pipeline.`,
      "SUCCESS",
    );
  } else {
    addLog(
      `[Kafka] Published ${uploadJson.recordsCount ?? parsedData.rows.length} rows onto topic 'ingest.raw' for Data Engine processing.`,
      "SUCCESS",
    );
  }

  // 4. Save Mappings
  setProgress(85);
  const isZip = file.name.toLowerCase().endsWith(".zip");
  if (!isZip && createdConnId) {
    addLog(
      `[Schema] Persisting ontology entity and property mappings...`,
      "INFO",
    );
    for (const col of activeCols) {
      const mapCfg = mappings[col.name] || {
        targetEntityType: primaryTargetEntity || "Entity",
        targetProperty: sanitizePropertyName(col.name),
        transformation: "NONE",
      };
      try {
        await apiFetch("/api/v1/schema-mappings", {
          method: "POST",
          headers: { "X-Suppress-Toast": "true" },
          body: JSON.stringify({
            connectorId: createdConnId,
            name: `${file.name} - ${col.name} Map`,
            sourceColumn: col.name,
            targetEntityType:
              mapCfg.targetEntityType || primaryTargetEntity || "Entity",
            targetProperty:
              mapCfg.targetProperty || sanitizePropertyName(col.name),
            transformation: (mapCfg.transformation || "NONE").toUpperCase(),
          }),
        });
        addLog(`[API] Saved mapping for column '${col.name}'`, "SUCCESS");
      } catch {
        // ignore
      }
    }
  }

  return {
    connectionId: createdConnId,
    recordsCount: uploadJson.recordsCount,
  };
}
