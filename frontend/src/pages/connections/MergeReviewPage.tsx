import React from "react";
import {
  Icons,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/layout/PageHeader";
import { CandidateInspector } from "./merge-review/CandidateInspector";
import { CandidatesListPanel } from "./merge-review/CandidatesListPanel";
import { useMergeReviewData } from "./merge-review/useMergeReviewData";

export type {
  RecordSnapshot,
  CandidateResponse,
} from "./merge-review/mergeTypes";

export const MergeReviewPage: React.FC = () => {
  const {
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    setSelectedCandidateId,
    scanError,
    setScanError,
    isLoading,
    isError,
    isRefetching,
    refetch,
    filteredCandidates,
    activeCandidate,
    allPropertyKeys,
    loadErrorMessage,
    acceptMutation,
    rejectMutation,
    scanMutation,
  } = useMergeReviewData();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-5 max-w-[1700px] mx-auto overflow-hidden">
      <PageHeader
        title="Fusion Review"
        breadcrumbs={[
          { label: "Data Pipelines", to: "/connections" },
          { label: "Fusion Review" },
        ]}
        description="Inspect high-confidence record pairs flagged by entity resolution. Review conflicting attributes and confirm deterministic merges."
        icon={
          <Icons.FusionReview
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              isLoading={isRefetching}
              disabled={isLoading || isRefetching}
              leftIcon={
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              }
            >
              Refresh pairs
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => scanMutation.mutate()}
              isLoading={scanMutation.isPending}
              disabled={scanMutation.isPending || isLoading}
              leftIcon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              {scanMutation.isPending
                ? "Scanning datasets..."
                : "Scan for duplicates"}
            </Button>
          </div>
        }
      />

      {(isError || scanError) && (
        <div
          role="alert"
          className="p-3.5 bg-error-bg border border-error-border rounded-lg flex flex-col gap-2 shrink-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-error">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isError
                  ? "Could not load merge candidates."
                  : "Duplicate scan encountered an error."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {scanError && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setScanError(null)}
                >
                  Dismiss
                </Button>
              )}
              <Button
                variant="secondary"
                size="xs"
                onClick={() => refetch()}
                isLoading={isRefetching}
              >
                Retry
              </Button>
            </div>
          </div>
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer select-none hover:text-text">
              Show details
            </summary>
            <p className="mt-1 text-error break-words">
              {isError ? loadErrorMessage : scanError}
            </p>
          </details>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-5 min-h-0 overflow-hidden">
        <CandidatesListPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          isLoading={isLoading}
          isError={isError}
          filteredCandidates={filteredCandidates}
          activeCandidateId={activeCandidate?.candidateId ?? null}
          onSelectCandidate={setSelectedCandidateId}
          onScan={() => scanMutation.mutate()}
          isScanPending={scanMutation.isPending}
        />

        <div className="flex-1 flex flex-col bg-surface border border-border rounded-lg overflow-hidden min-h-0">
          <CandidateInspector
            activeCandidate={activeCandidate}
            allPropertyKeys={allPropertyKeys}
            onAccept={(id) => acceptMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            isAcceptPending={acceptMutation.isPending}
            isRejectPending={rejectMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
};
