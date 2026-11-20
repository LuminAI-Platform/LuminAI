import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Icons,
  RefreshCw,
  Search,
  Sparkles,
  AlertCircle,
  ICON_SIZES,
} from "../../lib/icons";
import { apiFetch } from "../../lib/api";
import { Badge, SuggestedTag } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/ToastProvider";
import { PageHeader } from "../../components/layout/PageHeader";
import type { CandidateResponse, PageData } from "./merge-review/mergeTypes";
import { CandidateInspector } from "./merge-review/CandidateInspector";

export type {
  RecordSnapshot,
  CandidateResponse,
} from "./merge-review/mergeTypes";

interface ScanResponse {
  status?: string;
  message?: string;
  candidatesFound?: number;
}

async function parseErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === "string" && body.message.trim()) {
      return body.message;
    }
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // ignore JSON parse failure
  }
  if (res.status === 403) {
    return "You do not have permission for this action (requires Analyst, Data Engineer, or Admin role).";
  }
  return `${fallback} (HTTP ${res.status})`;
}

export const MergeReviewPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [scanError, setScanError] = useState<string | null>(null);

  const {
    data: pagedData,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
  } = useQuery<PageData>({
    queryKey: ["er", "candidates", statusFilter],
    queryFn: async () => {
      let url = "/api/v1/er/candidates?size=50";
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      const res = await apiFetch(url, {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(
          res,
          "Failed to load merge candidates",
        );
        throw new Error(msg);
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.content)) {
        return {
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: 50,
          number: 0,
        };
      }
      return data as PageData;
    },
  });

  const candidatesList = useMemo<CandidateResponse[]>(
    () => pagedData?.content ?? [],
    [pagedData],
  );

  const filteredCandidates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return candidatesList;
    return candidatesList.filter((c) => {
      const idA = String(c.recordA?.recordId ?? "").toLowerCase();
      const idB = String(c.recordB?.recordId ?? "").toLowerCase();
      const rationale = String(c.matchRationale ?? "").toLowerCase();
      const candId = String(c.candidateId ?? "").toLowerCase();
      return (
        idA.includes(term) ||
        idB.includes(term) ||
        rationale.includes(term) ||
        candId.includes(term)
      );
    });
  }, [candidatesList, searchTerm]);

  const activeCandidate =
    filteredCandidates.find((c) => c.candidateId === selectedCandidateId) ??
    filteredCandidates[0] ??
    null;

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/er/candidates/${id}/accept`, {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Accept candidate failed");
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        "Candidate merged",
        "Records fused into unified Golden Record and published to graph.",
      );
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
    },
    onError: (err: Error) => {
      toast.error("Merge failed", err.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/er/candidates/${id}/reject`, {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Reject candidate failed");
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.info(
        "Candidate rejected",
        "Candidate pair marked as distinct entities.",
      );
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
    },
    onError: (err: Error) => {
      toast.error("Rejection failed", err.message);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (): Promise<ScanResponse> => {
      setScanError(null);
      const res = await apiFetch("/api/v1/er/candidates/scan", {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Duplicate scan failed");
        throw new Error(msg);
      }
      const data: ScanResponse = await res.json();
      if (String(data?.status ?? "").toUpperCase() === "ERROR") {
        throw new Error(
          data.message || "Duplicate scan returned an error from the server.",
        );
      }
      return data;
    },
    onSuccess: (data) => {
      const count = data?.candidatesFound ?? 0;
      if (count > 0) {
        toast.success(
          "Entity resolution scan complete",
          data?.message || `Identified ${count} duplicate candidate pair(s).`,
        );
      } else {
        toast.info(
          "Scan complete — no duplicates found",
          data?.message ||
            "No duplicate pairs detected in active connection sample rows.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
    },
    onError: (err: Error) => {
      setScanError(err.message);
      toast.error("Duplicate scan failed", err.message);
    },
  });

  const allPropertyKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(activeCandidate?.recordA?.properties ?? {}),
          ...Object.keys(activeCandidate?.recordB?.properties ?? {}),
        ]),
      ).sort(),
    [activeCandidate],
  );

  const loadErrorMessage =
    error instanceof Error ? error.message : "Could not load merge candidates.";

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

      {/* Load or Scan Error Banner */}
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

      {/* Main Grid View */}
      <div className="flex-1 flex flex-col md:flex-row gap-5 min-h-0 overflow-hidden">
        {/* Left: Candidates List */}
        <div className="w-full md:w-80 flex flex-col bg-surface border border-border rounded-lg overflow-hidden shrink-0 max-h-[40vh] md:max-h-none">
          <div className="p-3 border-b border-border flex flex-col gap-2.5 bg-surface-subtle/40">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-2.5"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search candidates by ID or rationale..."
                aria-label="Search candidates"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-secondary outline-none focus:border-border-focus"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
              {(["PENDING", "ACCEPTED", "REJECTED", "ALL"] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 cursor-pointer border ${
                      statusFilter === filter
                        ? "bg-primary-tint text-primary border-primary-border"
                        : "text-text-secondary border-transparent hover:text-text hover:bg-surface-subtle"
                    }`}
                  >
                    {filter.charAt(0) + filter.slice(1).toLowerCase()}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2 p-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center justify-center gap-3 text-text-secondary text-xs">
                <div className="w-9 h-9 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-text-secondary">
                  <Search className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-text mb-1">
                    {isError
                      ? "Unable to load candidates"
                      : searchTerm.trim()
                        ? "No matching candidates"
                        : "No merge candidates found"}
                  </p>
                  <p className="text-[11px] text-text-secondary max-w-[220px] mx-auto leading-relaxed">
                    {isError
                      ? "Check the error details above and retry."
                      : searchTerm.trim()
                        ? "Try clearing your search filter."
                        : "No duplicate record pairs in this queue. Run a scan across your active connections."}
                  </p>
                </div>
                {!isError && !searchTerm.trim() && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => scanMutation.mutate()}
                    isLoading={scanMutation.isPending}
                    leftIcon={
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                    }
                  >
                    {scanMutation.isPending
                      ? "Scanning..."
                      : "Run linkage scan"}
                  </Button>
                )}
              </div>
            ) : (
              filteredCandidates.map((candidate) => {
                const isSelected =
                  activeCandidate?.candidateId === candidate.candidateId;
                const scorePercent = Math.round(
                  (candidate.similarityScore ?? 0) * 100,
                );
                return (
                  <button
                    key={candidate.candidateId}
                    type="button"
                    onClick={() =>
                      setSelectedCandidateId(candidate.candidateId)
                    }
                    className={`w-full text-left p-3.5 cursor-pointer transition-colors border-l-2 ${
                      isSelected
                        ? "bg-primary-tint/50 border-l-primary"
                        : "border-l-transparent hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <SuggestedTag label="Suggested" />
                        <span className="text-[10px] text-text-secondary font-medium">
                          {scorePercent}% match
                        </span>
                      </div>
                      <Badge
                        variant="neutral"
                        className="text-[10px] uppercase font-bold py-0 h-4"
                      >
                        {candidate.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-text truncate mb-1">
                      {candidate.recordA?.recordId ?? "Record A"} →{" "}
                      {candidate.recordB?.recordId ?? "Record B"}
                    </div>
                    <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                      {candidate.matchRationale || "Similarity match detected"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Side-by-Side Comparison & Action Console */}
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
