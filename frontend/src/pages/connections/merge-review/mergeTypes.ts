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

/**
 * Design Rule 5: AI-suggested indicators should be calm neutral or navy-tint,
 * with no neon glows or conflicting multi-colors.
 */
export function getScoreColor(score: number): string {
  if (score >= 0.75) {
    return "bg-suggested-bg text-suggested border-suggested-border font-medium";
  }
  return "bg-nodata-bg text-nodata border-nodata-border";
}
