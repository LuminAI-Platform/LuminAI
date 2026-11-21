import { useState, useCallback } from "react";
import { apiFetch } from "../../../lib/api";
import type { IngestedFile, CleanDataResponse } from "./connectionsTypes";

function buildFailedCleanData(file: IngestedFile): CleanDataResponse {
  const rawRows = file.sampleRows || [];
  const rawCols =
    file.columns || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);
  return {
    connectionId: file.id,
    totalRawRecords: file.recordsCount || rawRows.length,
    totalCleanRecords: file.recordsCount || rawRows.length,
    duplicatesMerged: 0,
    compressionRatio: "1.0x",
    dataQualityScore: 0.0,
    status: "FAILED",
    columns: rawCols,
    rows: rawRows,
  };
}

export function useConnectionPreviews() {
  const [previewingFile, setPreviewingFile] = useState<IngestedFile | null>(
    null,
  );
  const [isRawPreviewLoading, setIsRawPreviewLoading] = useState(false);
  const [cleanPreviewFile, setCleanPreviewFile] = useState<IngestedFile | null>(
    null,
  );
  const [cleanData, setCleanData] = useState<CleanDataResponse | null>(null);
  const [isCleanDataLoading, setIsCleanDataLoading] = useState(false);
  const [cleanSearchFilter, setCleanSearchFilter] = useState("");

  const handleOpenRawPreview = useCallback(async (file: IngestedFile) => {
    setPreviewingFile(file);
    setIsRawPreviewLoading(true);
    try {
      const res = await apiFetch(`/api/v1/connections/${file.id}`, {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (res.ok) {
        const item = await res.json();
        let config: Record<string, unknown> = {};
        if (typeof item.config === "string") {
          try {
            config = JSON.parse(item.config);
          } catch {
            // ignore
          }
        } else if (item.config && typeof item.config === "object") {
          config = item.config;
        }

        const fetchedColumns = Array.isArray(config.columns)
          ? (config.columns as string[])
          : undefined;
        const fetchedSampleRows = Array.isArray(config.sampleRows)
          ? (config.sampleRows as Record<string, unknown>[])
          : undefined;

        if (fetchedColumns || fetchedSampleRows) {
          setPreviewingFile((prev) =>
            prev && prev.id === file.id
              ? {
                  ...prev,
                  columns: fetchedColumns ?? prev.columns,
                  sampleRows: fetchedSampleRows ?? prev.sampleRows,
                }
              : prev,
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsRawPreviewLoading(false);
    }
  }, []);

  const handleInspectCleanData = useCallback(async (file: IngestedFile) => {
    setCleanPreviewFile(file);
    setIsCleanDataLoading(true);
    setCleanData(null);
    setCleanSearchFilter("");

    try {
      const res = await apiFetch(
        `/api/v1/connections/${file.id}/clean-preview`,
        {
          headers: { "X-Suppress-Toast": "true" },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setCleanData(data);
      } else {
        setCleanData(buildFailedCleanData(file));
      }
    } catch {
      setCleanData(buildFailedCleanData(file));
    } finally {
      setIsCleanDataLoading(false);
    }
  }, []);

  return {
    previewingFile,
    setPreviewingFile,
    isRawPreviewLoading,
    cleanPreviewFile,
    setCleanPreviewFile,
    cleanData,
    isCleanDataLoading,
    cleanSearchFilter,
    setCleanSearchFilter,
    handleOpenRawPreview,
    handleInspectCleanData,
  };
}
