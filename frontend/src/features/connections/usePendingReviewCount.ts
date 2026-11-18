import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

interface CandidatePageResponse {
  totalElements?: number;
  content?: unknown[];
}

/**
 * Fetches the count of ER candidates pending review from the backend data engine.
 * GET /api/v1/er/candidates?status=PENDING&size=1 returns totalElements.
 */
export function usePendingReviewCount() {
  return useQuery<number>({
    queryKey: ["er", "candidates", "count", "PENDING"],
    queryFn: async () => {
      try {
        const res = await apiFetch(
          "/api/v1/er/candidates?status=PENDING&size=1",
          {
            headers: { "X-Suppress-Toast": "true" },
          },
        );
        if (!res.ok) return 0;
        const data: CandidatePageResponse = await res.json();
        return typeof data.totalElements === "number" ? data.totalElements : 0;
      } catch {
        return 0;
      }
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });
}
