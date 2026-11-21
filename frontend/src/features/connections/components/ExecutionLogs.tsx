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
import {
  computeLevelCounts,
  filterLogEntries,
} from "./execution-logs/executionLogParser";
import { useExecutionLogsData } from "./execution-logs/useExecutionLogsData";
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
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    logs,
    errors,
    isConnected,
    hasActiveRun,
    liveAnnouncement,
    clearLogs,
    handleReconnect,
    dismissError,
    getCachedRun,
  } = useExecutionLogsData({
    controlledEntries,
    controlledErrors,
    controlledConnected,
    controlledHasActiveRun,
    maxLines,
    paused,
  });

  // Always sort by full timestamp ascending (newest at bottom)
  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => a.ts.getTime() - b.ts.getTime()),
    [logs],
  );

  const levelCounts = useMemo(
    () => computeLevelCounts(sortedLogs),
    [sortedLogs],
  );

  const displayedLogs = useMemo(
    () => filterLogEntries(sortedLogs, filter, searchTerm),
    [sortedLogs, filter, searchTerm],
  );

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
    clearLogs();
    setConfirmClearOpen(false);
  };

  const handleOpenRunId = (runId: string, triggerEl: HTMLElement | null) => {
    if (!onOpenRunDetail) return;
    const cached = getCachedRun(runId);
    onOpenRunDetail(cached ?? runId, triggerEl);
  };

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
      {/* ARIA live region for run completion announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Panel header */}
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

      {/* Filter toolbar */}
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

      {/* Error callouts section */}
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

      {/* Main log console */}
      <LogConsole
        logs={displayedLogs}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        isFollowing={isFollowing}
        onJumpToLatest={handleJumpToLatest}
        onOpenRunDetail={handleOpenRunId}
      />

      {/* Clear view confirmation dialog */}
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
