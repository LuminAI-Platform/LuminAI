import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitMerge,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/ToastProvider";
import { PageHeader } from "../../components/layout/PageHeader";

export interface RecordSnapshot {
  recordId: string;
  properties: Record<string, unknown>;
}

export interface CandidateResponse {
  candidateId: string;
  goldenRecordId: string;
  recordA: RecordSnapshot;
  recordB: RecordSnapshot;
  similarityScore: number;
  matchRationale: string;
  comparisonDetails?: Record<string, unknown>;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reviewedAt?: string;
  reviewedBy?: string;
}

interface PageData {
  content: CandidateResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Entity Resolution (ER) & Record Fusion Review Console
 */
export const MergeReviewPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );

  // 1. Fetch Candidates List from real backend API
  const {
    data: pagedData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<PageData>({
    queryKey: ["er", "candidates", statusFilter],
    queryFn: async () => {
      let url = "/api/v1/er/candidates?size=50";
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`;
      }
      const res = await apiFetch(url, {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
  });

  const candidatesList: CandidateResponse[] = pagedData?.content || [];

  // Auto-select first candidate if none selected
  const activeCandidate =
    candidatesList.find((c) => c.candidateId === selectedCandidateId) ||
    candidatesList[0] ||
    null;

  // 2. Accept Merge Mutation
  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/er/candidates/${id}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Accept candidate failed with HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        "Candidate Merged",
        "Records fused into unified Golden Record and published to graph.",
      );
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
    onError: (err: unknown) => {
      toast.error(
        "Merge Failed",
        err instanceof Error ? err.message : "Unable to accept candidate.",
      );
    },
  });

  // 3. Reject Candidate Mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/er/candidates/${id}/reject`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Reject candidate failed with HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.info("Marked Distinct", "Candidate marked as non-matching entity.");
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
    },
    onError: (err: unknown) => {
      toast.error(
        "Action Failed",
        err instanceof Error ? err.message : "Unable to reject candidate.",
      );
    },
  });

  const filteredCandidates = candidatesList.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameA = String(
      c.recordA.properties?.canonicalName || "",
    ).toLowerCase();
    const nameB = String(
      c.recordB.properties?.canonicalName || "",
    ).toLowerCase();
    return (
      nameA.includes(term) ||
      nameB.includes(term) ||
      c.candidateId.includes(term)
    );
  });

  // Extract all property keys across both records for side-by-side diff
  const allPropertyKeys = Array.from(
    new Set([
      ...Object.keys(activeCandidate?.recordA.properties || {}),
      ...Object.keys(activeCandidate?.recordB.properties || {}),
    ]),
  );

  const getScoreColor = (score: number) => {
    if (score >= 0.9)
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 0.75)
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  };

  return (
    <div className="flex flex-col h-full gap-4 pb-6 select-none overflow-hidden">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Data Integration", to: "/connections" },
          { label: "Fusion Review" },
        ]}
        title="Entity Resolution & Fusion Review"
        description="Review duplicate candidate pairs, inspect property conflicts, and merge into unified Golden Records."
        icon={<GitMerge className="w-5 h-5 text-indigo-400" />}
        badge={{
          label: "Resolution Active",
          variant: "purple",
        }}
        actions={
          <div className="flex items-center gap-2">
            {/* Status Tabs */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
              {["PENDING", "ACCEPTED", "REJECTED", "ALL"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    statusFilter === s
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => refetch()}
              disabled={isRefetching}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
                />
              }
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
        {/* Left: Candidates Master List */}
        <div className="w-full lg:w-96 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shrink-0 max-h-[30vh] lg:max-h-none">
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-zinc-500">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Loading candidates...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No resolution candidates match the filter criteria.
              </div>
            ) : (
              filteredCandidates.map((c) => {
                const isSelected =
                  activeCandidate?.candidateId === c.candidateId;
                const nameA = String(
                  c.recordA.properties?.canonicalName || "Record A",
                );
                const nameB = String(
                  c.recordB.properties?.canonicalName || "Record B",
                );

                return (
                  <div
                    key={c.candidateId}
                    onClick={() => setSelectedCandidateId(c.candidateId)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-600/10 border-l-2 border-indigo-500"
                        : "hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${getScoreColor(c.similarityScore)}`}
                      >
                        {Math.round(c.similarityScore * 100)}% Match
                      </span>
                      <Badge
                        variant={
                          c.status === "ACCEPTED"
                            ? "success"
                            : c.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {c.status}
                      </Badge>
                    </div>

                    <div className="text-xs font-semibold text-zinc-200 truncate">
                      {nameA}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                      <span className="text-zinc-600">vs</span>
                      <span>{nameB}</span>
                    </div>

                    <p className="text-[10px] text-zinc-500 mt-2 line-clamp-1 italic">
                      {c.matchRationale}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Side-by-Side Comparison & Action Console */}
        <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {activeCandidate ? (
            <>
              {/* Review Inspector Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">
                      ID: {activeCandidate.candidateId}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${getScoreColor(activeCandidate.similarityScore)}`}
                    >
                      {Math.round(activeCandidate.similarityScore * 100)}%
                      Confidence
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-medium mt-1">
                    {activeCandidate.matchRationale}
                  </p>
                </div>

                {activeCandidate.status === "PENDING" && (
                  <div className="flex items-center gap-2.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        rejectMutation.mutate(activeCandidate.candidateId)
                      }
                      disabled={
                        rejectMutation.isPending || acceptMutation.isPending
                      }
                      leftIcon={
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      }
                    >
                      Mark Distinct
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        acceptMutation.mutate(activeCandidate.candidateId)
                      }
                      disabled={
                        acceptMutation.isPending || rejectMutation.isPending
                      }
                      leftIcon={
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      }
                    >
                      Accept & Merge
                    </Button>
                  </div>
                )}
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/60 shadow-inner flex-1 min-h-0 flex flex-col">
                  <div className="overflow-auto min-w-0 flex-1">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 shadow-xs">
                        <tr className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                          <th className="py-2.5 px-3 min-w-[140px] w-1/4">
                            Property
                          </th>
                          <th className="py-2.5 px-3 min-w-[200px] w-3/8 text-blue-400 border-l border-zinc-800">
                            Source Record A (
                            {String(
                              activeCandidate.recordA.properties
                                ?.sourceSystem || "CRM",
                            )}
                            )
                          </th>
                          <th className="py-2.5 px-3 min-w-[200px] w-3/8 text-purple-400 border-l border-zinc-800">
                            Source Record B (
                            {String(
                              activeCandidate.recordB.properties
                                ?.sourceSystem || "ERP",
                            )}
                            )
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 font-mono text-[11px]">
                        {allPropertyKeys.map((key) => {
                          const valA =
                            activeCandidate.recordA.properties?.[key];
                          const valB =
                            activeCandidate.recordB.properties?.[key];
                          const strA = valA !== undefined ? String(valA) : "—";
                          const strB = valB !== undefined ? String(valB) : "—";
                          const isMatch = strA === strB && strA !== "—";
                          const isConflict =
                            strA !== "—" && strB !== "—" && strA !== strB;

                          return (
                            <tr
                              key={key}
                              className={`transition-colors ${
                                isConflict
                                  ? "bg-amber-500/5"
                                  : isMatch
                                    ? "bg-emerald-500/5"
                                    : "hover:bg-zinc-800/20"
                              }`}
                            >
                              <td className="py-2 px-3 text-zinc-400 font-sans font-medium flex items-center justify-between whitespace-nowrap">
                                <span>{key}</span>
                                {isConflict && (
                                  <span className="text-[10px] text-amber-400 flex items-center gap-0.5 ml-2">
                                    <AlertTriangle className="w-3 h-3" />
                                  </span>
                                )}
                                {isMatch && (
                                  <span className="text-[10px] text-emerald-400 ml-2">
                                    ✓
                                  </span>
                                )}
                              </td>
                              <td
                                className={`py-2 px-3 border-l border-zinc-800 break-words max-w-sm ${isConflict ? "text-amber-200" : isMatch ? "text-emerald-200" : "text-zinc-300"}`}
                              >
                                {strA}
                              </td>
                              <td
                                className={`py-2 px-3 border-l border-zinc-800 break-words max-w-sm ${isConflict ? "text-amber-200" : isMatch ? "text-emerald-200" : "text-zinc-300"}`}
                              >
                                {strB}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Golden Record Lineage Summary */}
                <div className="mt-4 p-3.5 bg-zinc-950/50 border border-zinc-800 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-zinc-400">Target Golden Record:</span>
                    <span className="font-mono text-zinc-200 font-semibold">
                      {activeCandidate.goldenRecordId}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Deterministic merge rules resolve conflicting attributes via
                    priority matrix
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <GitMerge className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-sm font-medium">
                Select a candidate pair to review
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
