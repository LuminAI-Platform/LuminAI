import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mockGetAccessToken = vi.fn(() => "jwt-secret-token-123");

vi.mock("../lib/api", () => ({
  API_BASE_URL: "http://localhost:8080",
  getAccessToken: () => mockGetAccessToken(),
}));

import {
  usePipelineStream,
  type UsePipelineStreamResult,
} from "../features/connections/hooks/usePipelineStream";

describe("usePipelineStream — fetch SSE with Bearer Authorization", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = "";
  });

  it("sends Authorization header without leaking token in URL and parses SSE events", async () => {
    const encoder = new TextEncoder();
    const sseChunks = [
      encoder.encode("event: pipeline.connected\ndata: ok\n\n"),
      encoder.encode(
        'event: pipeline.progress\ndata: {"runId":"run-42","step":"clean","progress":75,"message":"Cleaning"}\n\n',
      ),
      encoder.encode(
        'event: pipeline.complete\ndata: {"runId":"run-42","totalRecords":10,"cleanedRecords":9,"errorsCount":1,"duration":"1s"}\n\n',
      ),
    ];

    let idx = 0;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (idx < sseChunks.length) {
              return { value: sseChunks[idx++], done: false };
            }
            return { value: undefined, done: true };
          },
        }),
      },
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    let latest: UsePipelineStreamResult | null = null;
    function Harness() {
      latest = usePipelineStream({ runId: "run-42" });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Harness));
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(
      "http://localhost:8080/api/v1/pipelines/stream/run-42?runId=run-42",
    );
    expect(calledUrl).not.toContain("token=");
    expect(calledUrl).not.toContain("access_token=");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer jwt-secret-token-123",
    );

    expect(latest).not.toBeNull();
    expect(latest!.stepProgress["run-42-clean"]).toMatchObject({
      progress: 75,
      message: "Cleaning",
    });
    expect(latest!.completions["run-42"]).toMatchObject({
      cleanedRecords: 9,
      errorsCount: 1,
    });

    await act(async () => {
      root.unmount();
    });
  });
});
