import React from "react";
import {
  GitMerge,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { CandidateResponse } from "./mergeTypes";
import { getScoreColor } from "./mergeTypes";

interface CandidateInspectorProps {
  activeCandidate: CandidateResponse | null;
  allPropertyKeys: string[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAcceptPending: boolean;
  isRejectPending: boolean;
}

export const CandidateInspector: React.FC<CandidateInspectorProps> = ({
  activeCandidate,
  allPropertyKeys,
  onAccept,
  onReject,
  isAcceptPending,
  isRejectPending,
}) => {
  if (!activeCandidate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
        <GitMerge className="w-8 h-8 text-zinc-600 mb-2" />
        <p className="text-sm font-medium">Select a candidate pair to review</p>
      </div>
    );
  }

  return (
    <>
      {/* Review Inspector Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">
              ID: {activeCandidate.candidateId}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border font-medium ${getScoreColor(activeCandidate.similarityScore)}`}
            >
              Suggested match ·{" "}
              {Math.round(activeCandidate.similarityScore * 100)}% confidence
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
              onClick={() => onReject(activeCandidate.candidateId)}
              disabled={isRejectPending || isAcceptPending}
              leftIcon={<XCircle className="w-3.5 h-3.5 text-red-400" />}
            >
              Mark Distinct
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAccept(activeCandidate.candidateId)}
              disabled={isAcceptPending || isRejectPending}
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
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/60 shadow-inner flex-1 min-h-0 flex flex-col">
          <div className="overflow-x-auto overflow-y-auto min-w-0 flex-1 scrollbar-thin">
            <table className="w-full min-w-[650px] text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 shadow-xs">
                <tr className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3 min-w-[140px] w-1/4">Property</th>
                  <th className="py-2.5 px-3 min-w-[200px] w-3/8 text-blue-400 border-l border-zinc-800">
                    Source Record A (
                    {String(
                      activeCandidate.recordA.properties?.sourceSystem || "CRM",
                    )}
                    )
                  </th>
                  <th className="py-2.5 px-3 min-w-[200px] w-3/8 text-purple-400 border-l border-zinc-800">
                    Source Record B (
                    {String(
                      activeCandidate.recordB.properties?.sourceSystem || "ERP",
                    )}
                    )
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 font-mono text-[11px]">
                {allPropertyKeys.map((key) => {
                  const valA = activeCandidate.recordA.properties?.[key];
                  const valB = activeCandidate.recordB.properties?.[key];
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
  );
};
