import React from "react";
import { Search, Sparkles } from "../../../lib/icons";
import { Badge, SuggestedTag } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import type { CandidateResponse } from "./mergeTypes";

const STATUS_FILTERS = ["PENDING", "ACCEPTED", "REJECTED", "ALL"] as const;

interface CandidatesListPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  isLoading: boolean;
  isError: boolean;
  filteredCandidates: CandidateResponse[];
  activeCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
  onScan: () => void;
  isScanPending: boolean;
}

export const CandidatesListPanel: React.FC<CandidatesListPanelProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isLoading,
  isError,
  filteredCandidates,
  activeCandidateId,
  onSelectCandidate,
  onScan,
  isScanPending,
}) => (
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
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-secondary outline-none focus:border-border-focus"
        />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onStatusFilterChange(filter)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 cursor-pointer border ${
              statusFilter === filter
                ? "bg-primary-tint text-primary border-primary-border"
                : "text-text-secondary border-transparent hover:text-text hover:bg-surface-subtle"
            }`}
          >
            {filter.charAt(0) + filter.slice(1).toLowerCase()}
          </button>
        ))}
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
              onClick={onScan}
              isLoading={isScanPending}
              leftIcon={<Sparkles className="w-3 h-3" aria-hidden="true" />}
            >
              {isScanPending ? "Scanning..." : "Run linkage scan"}
            </Button>
          )}
        </div>
      ) : (
        filteredCandidates.map((candidate) => {
          const isSelected = activeCandidateId === candidate.candidateId;
          const scorePercent = Math.round(
            (candidate.similarityScore ?? 0) * 100,
          );
          return (
            <button
              key={candidate.candidateId}
              type="button"
              onClick={() => onSelectCandidate(candidate.candidateId)}
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
);
