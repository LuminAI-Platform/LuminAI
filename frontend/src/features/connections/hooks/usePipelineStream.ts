import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL, getAccessToken } from "../../../lib/api";

export interface PipelineProgressEvent {
  runId: string;
  step: string;
  progress: number;
  message: string;
}

export interface PipelineErrorEvent {
  runId: string;
  step: string;
  error: string;
  severity: "error" | "warning" | "info";
  timestamp?: string;
}

export interface PipelineCompleteEvent {
  runId: string;
  totalRecords: number;
  cleanedRecords: number;
  errorsCount: number;
  duration: string;
}

export interface UsePipelineStreamOptions {
  runId?: string;
  onProgress?: (event: PipelineProgressEvent) => void;
  onErrorEvent?: (event: PipelineErrorEvent) => void;
  onComplete?: (event: PipelineCompleteEvent) => void;
}

export interface UsePipelineStreamResult {
  isConnected: boolean;
  isPolling: boolean;
  lastHeartbeat: Date | null;
  stepProgress: Record<string, PipelineProgressEvent>;
  errors: PipelineErrorEvent[];
  completions: Record<string, PipelineCompleteEvent>;
  clearErrors: () => void;
  reconnect: () => void;
}

/**
 * Custom React hook for consuming real-time Server-Sent Events (SSE)
 * from /api/v1/pipelines/stream with automated heartbeat tracking,
 * structured event parsing, and polling fallback.
 */
export function usePipelineStream(
  options: UsePipelineStreamOptions = {},
): UsePipelineStreamResult {
  const { runId, onProgress, onErrorEvent, onComplete } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [stepProgress, setStepProgress] = useState<
    Record<string, PipelineProgressEvent>
  >({});
  const [errors, setErrors] = useState<PipelineErrorEvent[]>([]);
  const [completions, setCompletions] = useState<
    Record<string, PipelineCompleteEvent>
  >({});

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const connectRef = useRef<() => void>(() => {});

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    try {
      const token = getAccessToken() ?? "";
      const queryParams = new URLSearchParams();
      if (token) queryParams.set("token", token);
      if (runId) queryParams.set("runId", runId);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const streamUrl = runId
        ? `${API_BASE_URL}/api/v1/pipelines/stream/${runId}${qs}`
        : `${API_BASE_URL}/api/v1/pipelines/stream${qs}`;

      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setIsPolling(false);
        setLastHeartbeat(new Date());
      };

      // Handle handshake connected event
      es.addEventListener("pipeline.connected", () => {
        setIsConnected(true);
        setIsPolling(false);
        setLastHeartbeat(new Date());
      });

      // Handle step progress updates (pipeline.progress)
      es.addEventListener("pipeline.progress", (e: MessageEvent) => {
        try {
          const data: PipelineProgressEvent = JSON.parse(e.data);
          setStepProgress((prev) => ({
            ...prev,
            [`${data.runId}-${data.step}`]: data,
          }));
          onProgress?.(data);
        } catch {
          // ignore parse error
        }
      });

      // Handle inline errors (pipeline.error)
      es.addEventListener("pipeline.error", (e: MessageEvent) => {
        try {
          const data: PipelineErrorEvent = JSON.parse(e.data);
          const enriched: PipelineErrorEvent = {
            ...data,
            timestamp: new Date().toLocaleTimeString(),
          };
          setErrors((prev) => [enriched, ...prev.slice(0, 19)]);
          onErrorEvent?.(enriched);
        } catch {
          // ignore parse error
        }
      });

      // Handle pipeline completion (pipeline.complete)
      es.addEventListener("pipeline.complete", (e: MessageEvent) => {
        try {
          const data: PipelineCompleteEvent = JSON.parse(e.data);
          setCompletions((prev) => ({
            ...prev,
            [data.runId]: data,
          }));
          onComplete?.(data);
        } catch {
          // ignore parse error
        }
      });

      // Handle 15s heartbeat ping
      es.addEventListener("ping", () => {
        setLastHeartbeat(new Date());
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setIsConnected(false);
        setIsPolling(true);

        // Schedule reconnect attempt in 5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, 5000);
      };
    } catch {
      setIsConnected(false);
      setIsPolling(true);
    }
  }, [runId, onProgress, onErrorEvent, onComplete]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    isPolling,
    lastHeartbeat,
    stepProgress,
    errors,
    completions,
    clearErrors,
    reconnect: connect,
  };
}
