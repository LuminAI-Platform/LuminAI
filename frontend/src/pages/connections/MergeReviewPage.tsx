import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Badge, SuggestedTag } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/ToastProvider";
import { PageHeader } from "../../components/layout/PageHeader";
import type { CandidateResponse, PageData } from "./merge-review/mergeTypes";
import { CandidateInspector } from "./merge-review/CandidateInspector";

export type {
  RecordSnapshot,
  CandidateResponse,
} from "./merge-review/mergeTypes";

export const MergeReviewPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );

  const {
    data: pagedData,
    isLoading,
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
      return res.json();
    },
  });

  const candidatesList: CandidateResponse[] = pagedData?.content || [];
  const activeCandidate =
    candidatesList.find((c) => c.candidateId === selectedCandidateId) ||
    candidatesList[0] ||
    null;

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/er/candidates/${id}/accept`, {
        method: "POST",
      });
      if (!res.ok)
        throw new Error(`Accept candidate failed with HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        "Candidate Merged",
        "Records fused into unified Golden Record and published to graph.",
      );
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
    },
    onError: (err: Error) => {
      toast.error("Merge Failed", err.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/v1/er/candidates/${id}/reject`, {
        method: "POST",
      });
      if (!res.ok)
        throw new Error(`Reject candidate failed with HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      toast.info(
        "Candidate Rejected",
        "Candidate pair marked as distinct entities.",
      );
      queryClient.invalidateQueries({ queryKey: ["er", "candidates"] });
    },
    onError: (err: Error) => {
      toast.error("Rejection Failed", err.message);
    },
  });

  const filteredCandidates = candidatesList.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const idA = c.recordA.recordId.toLowerCase();
    const idB = c.recordB.recordId.toLowerCase();
    const rationale = (c.matchRationale || "").toLowerCase();
    return idA.includes(term) || idB.includes(term) || rationale.includes(term);
  });

  const allPropertyKeys = Array.from(
    new Set([
      ...Object.keys(activeCandidate?.recordA.properties || {}),
      ...Object.keys(activeCandidate?.recordB.properties || {}),
    ]),
  ).sort();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-6 gap-5 max-w-[1700px] mx-auto overflow-hidden">
      <PageHeader
        title="Merge & Link Review Console"
        breadcrumbs={[
          { label: "Data Pipeline", to: "/connections" },
          { label: "Merge Review" },
        ]}
        description="Inspect high-confidence record pairs flagged by Graph Linkage algorithms. Review conflicting attributes and confirm deterministic merges."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
              />
              Refresh Pairs
            </button>
          </div>
        }
      />

      {/* Main Grid View */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
        {/* Left: Candidates List */}
        <div className="w-80 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shrink-0">
          <div className="p-3 border-b border-zinc-800 flex flex-col gap-2.5 bg-zinc-900/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search candidates by ID/type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-700"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
              {(["PENDING", "ACCEPTED", "REJECTED", "ALL"] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 ${
                      statusFilter === filter
                        ? "bg-zinc-800 text-zinc-200 border border-zinc-700"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {filter}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
            {isLoading ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                Loading candidate pairs...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No matching merge candidates found
              </div>
            ) : (
              filteredCandidates.map((candidate) => {
                const isSelected =
                  activeCandidate?.candidateId === candidate.candidateId;
                const scorePercent = Math.round(
                  candidate.similarityScore * 100,
                );
                return (
                  <div
                    key={candidate.candidateId}
                    onClick={() =>
                      setSelectedCandidateId(candidate.candidateId)
                    }
                    className={`p-3.5 cursor-pointer transition-all border-l-2 ${
                      isSelected
                        ? "bg-zinc-800/40 border-l-blue-500"
                        : "border-l-transparent hover:bg-zinc-800/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <SuggestedTag label="Suggested" />
                        <span className="text-[10px] text-text-secondary font-medium">
                          {scorePercent}% Match
                        </span>
                      </div>
                      <Badge
                        variant="neutral"
                        className="text-[10px] uppercase font-bold py-0 h-4"
                      >
                        {candidate.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-zinc-200 truncate mb-1">
                      {candidate.recordA.recordId} ➔{" "}
                      {candidate.recordB.recordId}
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                      {candidate.matchRationale}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Side-by-Side Comparison & Action Console */}
        <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
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
