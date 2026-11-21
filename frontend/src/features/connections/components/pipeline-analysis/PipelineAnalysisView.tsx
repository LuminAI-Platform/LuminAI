import React, { useState } from "react";
import { usePipelineAnalysis } from "./usePipelineAnalysis";
import { AnalysisControls } from "./AnalysisControls";
import { AnalysisSummaryCards } from "./AnalysisSummaryCards";
import { AnalysisTrendChart } from "./AnalysisTrendChart";
import { DataQualityPanel } from "./DataQualityPanel";
import { StageBreakdownPanel } from "./StageBreakdownPanel";
import { TopIssuesPanel } from "./TopIssuesPanel";
import { RunsTable } from "./RunsTable";
import {
  EngineUnreachableView,
  AnalysisLoadingSkeleton,
  AnalysisEmptyState,
} from "./AnalysisStateViews";

export const PipelineAnalysisView: React.FC = () => {
  const {
    timeRange,
    setTimeRange,
    pipelineFilter,
    setPipelineFilter,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    pageSize,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    uniquePipelines,
    engineMetrics,
    pipelineMetrics,
    runsPage,
    filteredRuns,
    timeSeries,
    stageBreakdown,
    topIssues,
    isLoading,
    isEngineReachable,
    metricsUpdatedAt,
    errorCode,
    errorMessage,
    handleRefresh,
  } = usePipelineAnalysis();

  const [selectedRunIdForDrawer, setSelectedRunIdForDrawer] = useState<
    string | null
  >(null);

  if (!isEngineReachable && !isLoading) {
    return (
      <EngineUnreachableView
        errorCode={errorCode}
        errorMessage={errorMessage}
        onRetry={handleRefresh}
      />
    );
  }

  if (isLoading && !engineMetrics && !runsPage) {
    return <AnalysisLoadingSkeleton />;
  }

  const totalRuns =
    engineMetrics?.pipelineStats?.totalRuns ??
    pipelineMetrics?.totalRunsCount ??
    runsPage?.totalElements ??
    0;

  if (totalRuns === 0 && !isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <AnalysisControls
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          pipelineFilter={pipelineFilter}
          onPipelineFilterChange={setPipelineFilter}
          uniquePipelines={uniquePipelines}
          metricsUpdatedAt={metricsUpdatedAt}
          onRefresh={handleRefresh}
        />
        <AnalysisEmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="pipeline-analysis-view">
      {/* 1. Controls */}
      <AnalysisControls
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        pipelineFilter={pipelineFilter}
        onPipelineFilterChange={setPipelineFilter}
        uniquePipelines={uniquePipelines}
        metricsUpdatedAt={metricsUpdatedAt}
        onRefresh={handleRefresh}
      />

      {/* 2. Summary cards */}
      <AnalysisSummaryCards
        pipelineStats={engineMetrics?.pipelineStats}
        pipelineMetrics={pipelineMetrics}
        failedRunsCount={
          runsPage?.content?.filter((r) => r.status === "FAILED").length ?? 0
        }
      />

      {/* 3. Throughput & Duration Trend Chart */}
      <AnalysisTrendChart data={timeSeries} isLoading={false} />

      {/* 4. Data Quality Panel */}
      <DataQualityPanel
        dataQuality={engineMetrics?.dataQuality}
        recordsEvaluated={engineMetrics?.pipelineStats?.recordsProcessed ?? 0}
      />

      {/* 5. Stage Breakdown */}
      <StageBreakdownPanel stages={stageBreakdown} />

      {/* 6. Top Issues */}
      <TopIssuesPanel
        topReasons={topIssues.topReasons}
        failingPipelines={topIssues.failingPipelines}
        onSelectRun={(runId) => setSelectedRunIdForDrawer(runId)}
      />

      {/* 7. Runs Table */}
      <RunsTable
        runs={filteredRuns}
        totalElements={runsPage?.totalElements ?? filteredRuns.length}
        totalPages={runsPage?.totalPages ?? 1}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={setPage}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(field) => {
          if (sortBy === field) {
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
          } else {
            setSortBy(field);
            setSortOrder("desc");
          }
        }}
        selectedRunId={selectedRunIdForDrawer}
        onClearSelectedRunId={() => setSelectedRunIdForDrawer(null)}
      />
    </div>
  );
};
