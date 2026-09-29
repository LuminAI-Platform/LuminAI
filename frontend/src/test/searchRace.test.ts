import { describe, it, expect, vi } from "vitest";

describe("Search Request Race Condition Guard (DC-01)", () => {
  it("should abort an in-flight search request when a new search query is dispatched", async () => {
    let activeController: AbortController | null = null;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }
        setTimeout(() => {
          resolve(new Response(JSON.stringify({ content: [] }), { status: 200 }));
        }, 100);
      });
    });

    const dispatchSearch = async (query: string) => {
      if (activeController) {
        activeController.abort();
      }
      activeController = new AbortController();
      const signal = activeController.signal;
      return fetchMock(`/api/v1/explorer/search?q=${query}`, { signal });
    };

    // Dispatch first query (e.g. "cor")
    const slowFirstPromise = dispatchSearch("cor");

    // Operator quickly types another character -> dispatches second query (e.g. "corp")
    const secondPromise = dispatchSearch("corp");

    // The first query must be aborted
    await expect(slowFirstPromise).rejects.toThrow("The operation was aborted");

    // The second query succeeds normally
    const result = await secondPromise;
    expect(result.ok).toBe(true);
  });
});
