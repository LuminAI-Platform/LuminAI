import { useState } from "react";
import type {
  IngestionLog,
  ParsedDataState,
  ColumnMappingConfig,
} from "./fileUploadTypes";
import type { ColumnConfig } from "../DataPreviewTable";
import { runIngestionPipeline } from "./runIngestionPipeline";

interface IngestionRunnerOptions {
  file: File | null;
  parsedData: ParsedDataState;
  columnsConfig: ColumnConfig[];
  mappings: Record<string, ColumnMappingConfig>;
  primaryTargetEntity: string;
  backendEntityTypes: string[];
  onSuccess?: () => void;
}

export function useIngestionRunner(opts: IngestionRunnerOptions) {
  const [ingesting, setIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionLogs, setIngestionLogs] = useState<IngestionLog[]>([]);
  const [ingestedCount, setIngestedCount] = useState(0);
  const [ingestionFinished, setIngestionFinished] = useState(false);
  const [ingestionFailed, setIngestionFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addLog = (message: string, level: IngestionLog["level"] = "INFO") => {
    const time = new Date().toLocaleTimeString();
    setIngestionLogs((prev) => [...prev, { timestamp: time, level, message }]);
  };

  const startIngestion = async () => {
    const {
      file,
      parsedData,
      columnsConfig,
      mappings,
      primaryTargetEntity,
      backendEntityTypes,
      onSuccess,
    } = opts;
    if (!file) return;
    setIngesting(true);
    setIngestionProgress(10);
    setIngestionFinished(false);
    setIngestionFailed(false);
    setErrorMessage(null);
    setIngestionLogs([]);

    addLog(`Starting ingestion pipeline for file: ${file.name}`, "INFO");
    try {
      const createdConnId = await runIngestionPipeline({
        file,
        parsedData,
        columnsConfig,
        mappings,
        primaryTargetEntity,
        backendEntityTypes,
        addLog,
        setProgress: setIngestionProgress,
      });

      setIngestedCount(parsedData.rows.length);
      setIngestionProgress(100);
      setIngestionFinished(true);
      setIngesting(false);
      addLog(
        `[Sync] Ingestion pipeline execution completed successfully.`,
        "SUCCESS",
      );

      const newFileItem = {
        id: createdConnId || String(Date.now()),
        name: file.name,
        size:
          file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            : `${Math.round(file.size / 1024)} KB`,
        recordsCount: parsedData.rows.length,
        status: "Synced",
        createdAt: new Date().toLocaleString(),
        columns: parsedData.columns,
        sampleRows: parsedData.rows.slice(0, 50),
      };
      try {
        const existing = JSON.parse(
          localStorage.getItem("local_ingested_files") || "[]",
        );
        const updated = [
          newFileItem,
          ...existing.filter(
            (f: { id: string; name: string }) =>
              f.id !== newFileItem.id && f.name !== newFileItem.name,
          ),
        ];
        localStorage.setItem("local_ingested_files", JSON.stringify(updated));
      } catch {
        // ignore
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ingestion failed";
      addLog(`[Error] Ingestion failure: ${msg}`, "ERROR");
      setIngestionFailed(true);
      setErrorMessage(msg);
      setIngesting(false);
    }
  };

  return {
    ingesting,
    ingestionProgress,
    ingestionLogs,
    ingestedCount,
    ingestionFinished,
    ingestionFailed,
    errorMessage,
    addLog,
    startIngestion,
  };
}
