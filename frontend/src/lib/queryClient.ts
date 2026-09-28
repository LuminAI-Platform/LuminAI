import { QueryClient } from "@tanstack/react-query";

/**
 * Global TanStack Query Client configured for production performance
 * Provides centralized caching, deduplication, and retry logic.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes cache retention
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
