import React, { useState, useEffect, useRef, useMemo } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";
import type {
  LogLevel,
  LogEntry,
  ExecutionError,
} from "./execution-logs/executionLogTypes";
import {
  resolveStreamStatus,
  formatLogLineForCopy,
} from "./execution-logs/executionLogTypes";
import { ErrorBlock } from "./execution-logs/ErrorBlock";
import { LogFilterToolbar } from "./execution-logs/LogFilterToolbar";
import { LogConsole } from "./execution-logs/LogConsole";
import { useExecutionLogStream } from "./execution-logs/useExecutionLogStream";
import { ExecutionLogsHeader } from "./execution-logs/ExecutionLogsHeader";

export type { LogLevel, LogEntry, ExecutionError };

interface ExecutionLogsProps {
  entries?: LogEntry[];
  errors?: ExecutionError[];
  maxLines?: number;
  title?: string;
  streamConnected?: boolean;
  hasActiveRun?: boolean;
  onOpenRunDetail?: (
    runOrId: PipelineRunItem | string,
    triggerEl: HTMLElement | null,
  ) => void;
}

export const ExecutionLogs: React.FC<ExecutionLogsProps> = ({
  entries: controlledEntries,
  errors: controlledErrors,
  maxLines = 500,
  title = "Pipeline Execution Stream",
  streamConnected: controlledConnected,
  hasActiveRun: controlledHasActiveRun,
  onOpenRunDetail,
}) => {
  const [internalErrors, setErrors] = useState<ExecutionError[]>([]);
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledEntries !== undefined;

  const {
    internalLogs,
    internalHasActiveRun,
    sseConnected,
    sseReconnect,
    runsByIdRef,
    fetchBackendLogs,
    clearInternalLogs,
  } = useExecutionLogStream({
    maxLines,
    isControlled,
    paused,
    onLiveAnnouncement: setLiveAnnouncement,
  });

  const logs = controlledEntries ?? internalLogs;
  const errors = controlledErrors ?? internalErrors;
  const isConnected = controlledConnected ?? sseConnected;
  const hasActiveRun = controlledHasActiveRun ?? internalHasActiveRun;

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => a.ts.getTime() - b.ts.getTime()),
    [logs],
  );

  const levelCounts = useMemo<Record<LogLevel | "ALL", number>>(() => {
    const counts: Record<LogLevel | "ALL", number> = {
      ALL: sortedLogs.length,
      INFO: 0,
      SUCCESS: 0,
      WARN: 0,
      ERROR: 0,
      DEBUG: 0,
    };
    sortedLogs.forEach((l) => {
      counts[l.level] = (counts[l.level] ?? 0) + 1;
    });
    return counts;
  }, [sortedLogs]);

  const displayedLogs = useMemo(() => {
    let result = sortedLogs;
    if (filter !== "ALL") {
      result = result.filter((l) => l.level === filter);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(lower) ||
          l.source.toLowerCase().includes(lower) ||
          (l.runId ? l.runId.toLowerCase().includes(lower) : false),
      );
    }
    return result;
  }, [sortedLogs, filter, searchTerm]);

  useEffect(() => {
    if (isFollowing && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLogs, isFollowing, paused]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setIsFollowing(atBottom);
  };

  const handleJumpToLatest = () => {
    setIsFollowing(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleCopyVisible = async () => {
    if (displayedLogs.length === 0) return;
    const text = displayedLogs.map(formatLogLineForCopy).join("\n");
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // Clipboard may be unavailable
    }
  };

  const handleConfirmClear = () => {
    clearInternalLogs(logs);
    setConfirmClearOpen(false);
  };

  const handleOpenRunId = (runId: string, triggerEl: HTMLElement | null) => {
    if (!onOpenRunDetail) return;
    const cached = runsByIdRef.current[runId];
    onOpenRunDetail(cached ?? runId, triggerEl);
  };

  const handleReconnect = () => {
    sseReconnect();
    fetchBackendLogs();
  };

  const dismissError = (id: string) =>
    setErrors((prev) => prev.filter((e) => e.id !== id));

  const streamState = resolveStreamStatus({
    isConnected,
    hasActiveRun,
    paused,
  });

  return (
    <section
      aria-label={title}
      className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden shadow-sm"
      data-testid="execution-logs"
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      <ExecutionLogsHeader
        title={title}
        entryCount={sortedLogs.length}
        streamState={streamState}
        paused={paused}
        onTogglePause={() => setPaused((v) => !v)}
        onReconnect={handleReconnect}
        onRequestClear={() => setConfirmClearOpen(true)}
        canClear={logs.length > 0}
      />

      <LogFilterToolbar
        filter={filter}
        setFilter={setFilter}
        counts={levelCounts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        visibleCount={displayedLogs.length}
        copiedAll={copiedAll}
        onCopyVisible={handleCopyVisible}
      />

      {errors.length > 0 && (
        <div className="flex flex-col gap-2 p-3 bg-error-bg border-b border-error-border">
          <div className="text-xs font-semibold text-error flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            <span>Active failures ({errors.length})</span>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {errors.map((err) => (
              <ErrorBlock key={err.id} error={err} onDismiss={dismissError} />
            ))}
          </div>
        </div>
      )}

      <LogConsole
        logs={displayedLogs}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        isFollowing={isFollowing}
        onJumpToLatest={handleJumpToLatest}
        onOpenRunDetail={handleOpenRunId}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Clear this view?"
        description="Clear this view? History is kept. Pipeline run records remain stored on the server."
        confirmText="Clear view"
        isDestructive={false}
        onConfirm={handleConfirmClear}
      />
    </section>
  );
};
