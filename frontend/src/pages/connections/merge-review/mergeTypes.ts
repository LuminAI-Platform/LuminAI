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

export interface PageData {
  content: CandidateResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export function getScoreColor(score: number): string {
  if (score >= 0.9)
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (score >= 0.75) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (score >= 0.5) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-zinc-800 text-zinc-400 border-zinc-700";
}
