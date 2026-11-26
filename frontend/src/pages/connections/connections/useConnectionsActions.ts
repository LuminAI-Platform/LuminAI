import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch, ApiError, ApiTimeoutError } from "../../../lib/api";
import type { IngestedFile, CleanDataResponse } from "./connectionsTypes";
import { useConnectionsSourceOps } from "./useConnectionsSourceOps";

export const CLEAN_PREVIEW_TIMEOUT_MS = 120_000;

interface UseConnectionsActionsProps {
  loadConnectors: (isInitial?: boolean) => Promise<void>;
}

async function extractCleanPreviewError(err: unknown): Promise<string> {
  if (err instanceof ApiTimeoutError) {
    return `Loading clean records timed out after ${Math.round(err.timeoutMs / 1000)}s. The Data Engine may still be processing this dataset — please retry.`;
  }
  if (err instanceof ApiError) {
    try {
      const body = (await err.response.clone().json()) as {
        message?: string;
        error?: string;
      };
      const detail = body.message || body.error;
      if (detail) return detail;
    } catch {
      // Response body was not JSON
    }
    if (err.status === 503 || err.status === 504) {
      return `Data Engine is temporarily unavailable (HTTP ${err.status}). Please retry in a moment.`;
    }
    return `Failed to load clean records (HTTP ${err.status}).`;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Failed to load clean records for this dataset.";
}

export function useConnectionsActions({
  loadConnectors,
}: UseConnectionsActionsProps) {
  const [previewingFile, setPreviewingFile] = useState<IngestedFile | null>(
    null,
  );
  const [isRawPreviewLoading, setIsRawPreviewLoading] = useState(false);
  const [cleanPreviewFile, setCleanPreviewFile] = useState<IngestedFile | null>(
    null,
  );
  const [cleanData, setCleanData] = useState<CleanDataResponse | null>(null);
  const [cleanDataError, setCleanDataError] = useState<string | null>(null);
  const [isCleanDataLoading, setIsCleanDataLoading] = useState(false);
  const [cleanSearchFilter, setCleanSearchFilter] = useState("");
  const cleanPreviewAbortRef = useRef<AbortController | null>(null);

  const sourceOps = useConnectionsSourceOps({ loadConnectors });

  useEffect(() => {
    return () => {
      cleanPreviewAbortRef.current?.abort();
      cleanPreviewAbortRef.current = null;
    };
  }, []);

  const closeCleanPreview = useCallback(() => {
    cleanPreviewAbortRef.current?.abort();
    cleanPreviewAbortRef.current = null;
    setCleanPreviewFile(null);
    setCleanData(null);
    setCleanDataError(null);
    setIsCleanDataLoading(false);
  }, []);

  const handleOpenRawPreview = async (file: IngestedFile) => {
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
            prev
              ? {
                  ...prev,
                  columns: fetchedColumns ?? prev.columns,
                  sampleRows: fetchedSampleRows ?? prev.sampleRows,
                }
              : null,
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setIsRawPreviewLoading(false);
    }
  };

  const handleInspectCleanData = useCallback(async (file: IngestedFile) => {
    cleanPreviewAbortRef.current?.abort();
    const controller = new AbortController();
    cleanPreviewAbortRef.current = controller;

    setCleanPreviewFile(file);
    setIsCleanDataLoading(true);
    setCleanData(null);
    setCleanDataError(null);
    setCleanSearchFilter("");

    try {
      const res = await apiFetch(
        `/api/v1/connections/${file.id}/clean-preview`,
        {
          timeoutMs: CLEAN_PREVIEW_TIMEOUT_MS,
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      const data = (await res.json()) as CleanDataResponse;
      if (controller.signal.aborted) return;
      setCleanData(data);
    } catch (err: unknown) {
      const isUserAbort =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError");
      if (isUserAbort) return;

      const msg = await extractCleanPreviewError(err);
      if (controller.signal.aborted) return;
      setCleanData(null);
      setCleanDataError(msg);
    } finally {
      if (cleanPreviewAbortRef.current === controller) {
        setIsCleanDataLoading(false);
      }
    }
  }, []);

  const retryCleanData = useCallback(() => {
    if (cleanPreviewFile) {
      void handleInspectCleanData(cleanPreviewFile);
    }
  }, [cleanPreviewFile, handleInspectCleanData]);

  return {
    previewingFile,
    setPreviewingFile,
    isRawPreviewLoading,
    cleanPreviewFile,
    setCleanPreviewFile,
    closeCleanPreview,
    cleanData,
    cleanDataError,
    isCleanDataLoading,
    cleanSearchFilter,
    setCleanSearchFilter,
    handleOpenRawPreview,
    handleInspectCleanData,
    retryCleanData,
    ...sourceOps,
  };
}
