import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/ui/ToastProvider";
import type { CandidateResponse, PageData } from "./mergeTypes";

export interface ScanResponse {
  status?: string;
  message?: string;
  candidatesFound?: number;
}

export async function parseErrorMessage(
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

export function useMergeReviewData() {
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

  return {
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    selectedCandidateId,
    setSelectedCandidateId,
    scanError,
    setScanError,
    isLoading,
    isError,
    isRefetching,
    refetch,
    filteredCandidates,
    activeCandidate,
    acceptMutation,
    rejectMutation,
    scanMutation,
    allPropertyKeys,
    loadErrorMessage,
  };
}
