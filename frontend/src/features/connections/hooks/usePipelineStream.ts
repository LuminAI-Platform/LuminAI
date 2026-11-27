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

function parseSseFrame(rawFrame: string): {
  eventType: string;
  data: string;
  isCommentOnly: boolean;
} {
  let eventType = "message";
  const dataLines: string[] = [];
  let hasNonComment = false;

  for (const line of rawFrame.split("\n")) {
    if (!line) continue;
    if (line.startsWith(":")) continue;
    hasNonComment = true;
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return {
    eventType,
    data: dataLines.join("\n"),
    isCommentOnly: !hasNonComment,
  };
}

/**
 * Custom React hook for consuming real-time Server-Sent Events (SSE)
 * from /api/v1/pipelines/stream via fetch() with Bearer Authorization
 * headers (never leaking tokens in URL query parameters), automated
 * heartbeat tracking, structured event parsing, and polling fallback.
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const connectRef = useRef<() => void>(() => {});

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const dispatchSseEvent = useCallback(
    (eventType: string, payload: string) => {
      if (eventType === "pipeline.connected") {
        setIsConnected(true);
        setIsPolling(false);
        setLastHeartbeat(new Date());
        return;
      }
      if (eventType === "ping" || eventType === "pipeline.heartbeat") {
        setLastHeartbeat(new Date());
        return;
      }
      if (!payload) return;

      if (eventType === "pipeline.progress") {
        try {
          const data: PipelineProgressEvent = JSON.parse(payload);
          setStepProgress((prev) => ({
            ...prev,
            [`${data.runId}-${data.step}`]: data,
          }));
          onProgress?.(data);
        } catch {
          // ignore parse error
        }
      } else if (eventType === "pipeline.error") {
        try {
          const data: PipelineErrorEvent = JSON.parse(payload);
          const enriched: PipelineErrorEvent = {
            ...data,
            timestamp: new Date().toLocaleTimeString(),
          };
          setErrors((prev) => [enriched, ...prev.slice(0, 19)]);
          onErrorEvent?.(enriched);
        } catch {
          // ignore parse error
        }
      } else if (eventType === "pipeline.complete") {
        try {
          const data: PipelineCompleteEvent = JSON.parse(payload);
          setCompletions((prev) => ({
            ...prev,
            [data.runId]: data,
          }));
          onComplete?.(data);
        } catch {
          // ignore parse error
        }
      }
    },
    [onProgress, onErrorEvent, onComplete],
  );

  const connect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const scheduleReconnect = () => {
      if (controller.signal.aborted) return;
      setIsConnected(false);
      setIsPolling(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!controller.signal.aborted) {
          connectRef.current();
        }
      }, 5000);
    };

    const startStream = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (runId) queryParams.set("runId", runId);
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
        const streamUrl = runId
          ? `${API_BASE_URL}/api/v1/pipelines/stream/${runId}${qs}`
          : `${API_BASE_URL}/api/v1/pipelines/stream${qs}`;

        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };
        const token = getAccessToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(streamUrl, {
          method: "GET",
          headers,
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          scheduleReconnect();
          return;
        }

        setIsConnected(true);
        setIsPolling(false);
        setLastHeartbeat(new Date());

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder
            .decode(value, { stream: true })
            .replace(/\r\n?/g, "\n");

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const rawFrame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const parsed = parseSseFrame(rawFrame);
            if (!parsed.isCommentOnly) {
              dispatchSseEvent(parsed.eventType, parsed.data);
            } else if (rawFrame.includes(":")) {
              setLastHeartbeat(new Date());
            }
            boundary = buffer.indexOf("\n\n");
          }
        }

        scheduleReconnect();
      } catch {
        if (!controller.signal.aborted) {
          scheduleReconnect();
        }
      }
    };

    void startStream();
  }, [runId, dispatchSseEvent]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
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
