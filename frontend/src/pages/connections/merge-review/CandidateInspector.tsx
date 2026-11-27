import React, { useState } from "react";
import {
  GitMerge,
  GitFork,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Badge, SuggestedTag } from "../../../components/ui/Badge";
import type { CandidateResponse } from "./mergeTypes";

interface CandidateInspectorProps {
  activeCandidate: CandidateResponse | null;
  allPropertyKeys: string[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSplit?: (goldenRecordId: string, sourceRecordIdToExtract: string) => void;
  isAcceptPending: boolean;
  isRejectPending: boolean;
  isSplitPending?: boolean;
}

export const CandidateInspector: React.FC<CandidateInspectorProps> = ({
  activeCandidate,
  allPropertyKeys,
  onAccept,
  onReject,
  onSplit,
  isAcceptPending,
  isRejectPending,
  isSplitPending = false,
}) => {
  const [confirmSplitOpen, setConfirmSplitOpen] = useState(false);

  if (!activeCandidate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-secondary">
        <GitMerge className="w-8 h-8 text-text-muted mb-2" aria-hidden="true" />
        <p className="text-sm font-medium text-text">
          Select a candidate pair to review
        </p>
        <p className="text-xs text-text-secondary mt-1">
          Compare source properties side by side before merging or marking as
          distinct.
        </p>
      </div>
    );
  }

  const comparisonEntries = activeCandidate.comparisonDetails
    ? Object.entries(activeCandidate.comparisonDetails)
    : [];

  return (
    <>
      {/* Review Inspector Header */}
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-surface">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-text-secondary truncate max-w-[260px]">
              ID: {activeCandidate.candidateId}
            </span>
            <SuggestedTag label="Suggested" />
            <span className="text-[11px] text-text-secondary font-medium">
              {Math.round((activeCandidate.similarityScore ?? 0) * 100)}%
              confidence
            </span>
            {activeCandidate.status !== "PENDING" && (
              <Badge
                variant={
                  activeCandidate.status === "ACCEPTED" ? "success" : "neutral"
                }
                className="text-[10px] uppercase font-semibold"
              >
                {activeCandidate.status}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text font-medium mt-1">
            {activeCandidate.matchRationale ||
              "Candidate pair flagged for review"}
          </p>
        </div>

        {activeCandidate.status === "PENDING" && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              size="sm"
              variant="danger"
              onClick={() => onReject(activeCandidate.candidateId)}
              isLoading={isRejectPending}
              disabled={isRejectPending || isAcceptPending}
              leftIcon={<XCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Mark distinct
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAccept(activeCandidate.candidateId)}
              isLoading={isAcceptPending}
              disabled={isAcceptPending || isRejectPending}
              leftIcon={
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              }
            >
              Accept & merge
            </Button>
          </div>
        )}

        {activeCandidate.status === "ACCEPTED" &&
          onSplit &&
          activeCandidate.goldenRecordId &&
          activeCandidate.recordB?.recordId && (
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmSplitOpen(true)}
                isLoading={isSplitPending}
                disabled={isSplitPending}
                leftIcon={
                  <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
                }
              >
                Split record
              </Button>
            </div>
          )}
      </div>

      {comparisonEntries.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border bg-surface-subtle/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-text-secondary">
            Comparison details:
          </span>
          {comparisonEntries.map(([key, val]) => (
            <span key={key} className="text-text-secondary">
              <span className="font-medium text-text">{key}:</span>{" "}
              <span className="font-mono text-[11px]">
                {typeof val === "object" && val !== null
                  ? JSON.stringify(val)
                  : String(val)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Side-by-Side Comparison Table */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
        <div className="border border-border rounded-lg overflow-hidden bg-surface shadow-xs flex-1 min-h-0 flex flex-col">
          {allPropertyKeys.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-text-secondary">
              No property snapshots were returned for this candidate pair.
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto min-w-0 flex-1 scrollbar-thin">
              <table className="w-full min-w-[600px] text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-subtle border-b border-border shadow-xs">
                  <tr className="text-[11px] text-text-secondary font-semibold">
                    <th className="py-2.5 px-3 min-w-[140px] w-1/4">
                      Property
                    </th>
                    <th className="py-2.5 px-3 min-w-[200px] w-3/8 text-primary border-l border-border">
                      Source record A (
                      {String(
                        activeCandidate.recordA?.properties?.sourceSystem ||
                          "Source A",
                      )}
                      )
                    </th>
                    <th className="py-2.5 px-3 min-w-[200px] w-3/8 text-text border-l border-border">
                      Source record B (
                      {String(
                        activeCandidate.recordB?.properties?.sourceSystem ||
                          "Source B",
                      )}
                      )
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {allPropertyKeys.map((key) => {
                    const valA = activeCandidate.recordA?.properties?.[key];
                    const valB = activeCandidate.recordB?.properties?.[key];
                    const strA =
                      valA !== undefined && valA !== null ? String(valA) : "—";
                    const strB =
                      valB !== undefined && valB !== null ? String(valB) : "—";
                    const isMatch = strA === strB && strA !== "—";
                    const isConflict =
                      strA !== "—" && strB !== "—" && strA !== strB;

                    return (
                      <tr
                        key={key}
                        className={`transition-colors ${
                          isConflict
                            ? "bg-warning-bg/50"
                            : isMatch
                              ? "bg-success-bg/50"
                              : "hover:bg-surface-hover"
                        }`}
                      >
                        <td className="py-2 px-3 text-text-secondary font-sans font-medium flex items-center justify-between whitespace-nowrap">
                          <span>{key}</span>
                          {isConflict && (
                            <span className="text-[10px] text-warning flex items-center gap-0.5 ml-2">
                              <AlertTriangle
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                            </span>
                          )}
                          {isMatch && (
                            <span className="text-[10px] text-success ml-2">
                              ✓
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 border-l border-border break-words max-w-sm ${
                            isConflict
                              ? "text-warning"
                              : isMatch
                                ? "text-success"
                                : "text-text"
                          }`}
                        >
                          {strA}
                        </td>
                        <td
                          className={`py-2 px-3 border-l border-border break-words max-w-sm ${
                            isConflict
                              ? "text-warning"
                              : isMatch
                                ? "text-success"
                                : "text-text"
                          }`}
                        >
                          {strB}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Golden Record Lineage Summary */}
        <div className="mt-4 p-3.5 bg-surface-subtle border border-border rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck
              className="w-4 h-4 text-success shrink-0"
              aria-hidden="true"
            />
            <span className="text-text-secondary shrink-0">
              Target Golden Record:
            </span>
            <span className="font-mono text-text font-semibold truncate">
              {activeCandidate.goldenRecordId || "Will be created on merge"}
            </span>
          </div>
          <span className="text-[11px] text-text-secondary">
            Deterministic merge rules resolve conflicting attributes via
            priority matrix
          </span>
        </div>
      </div>

      {onSplit &&
        activeCandidate.goldenRecordId &&
        activeCandidate.recordB?.recordId && (
          <ConfirmDialog
            open={confirmSplitOpen}
            onOpenChange={setConfirmSplitOpen}
            title="Split merged record?"
            description="Extract source record B into its own separate Golden Record. This creates a new version of the existing Golden Record."
            confirmText="Split record"
            cancelText="Cancel"
            isDestructive={false}
            isLoading={isSplitPending}
            onConfirm={() => {
              onSplit(
                activeCandidate.goldenRecordId,
                activeCandidate.recordB.recordId,
              );
              setConfirmSplitOpen(false);
            }}
          />
        )}
    </>
  );
};
