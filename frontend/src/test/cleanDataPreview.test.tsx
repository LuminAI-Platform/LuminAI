import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { CleanDataModal } from "../pages/connections/connections/CleanDataModal";
import { CleanDataTelemetryStrip } from "../pages/connections/connections/CleanDataTelemetryStrip";
import {
  CLEAN_PREVIEW_TIMEOUT_MS,
  useConnectionsActions,
} from "../pages/connections/connections/useConnectionsActions";
import { parseJSON } from "../features/connections/components/file-upload/fileUploadTypes";
import { ApiError, ApiTimeoutError } from "../lib/api";
import type { IngestedFile } from "../pages/connections/connections/connectionsTypes";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockApiFetch = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("../components/ui/BodyPortal", () => ({
  BodyPortal: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    dismiss: vi.fn(),
  }),
  showToastNotification: vi.fn(),
}));

const SAMPLE_FILE: IngestedFile = {
  id: "conn-100k",
  name: "patients_100k.csv",
  size: "24.50 MB",
  recordsCount: 100000,
  status: "Connected",
  createdAt: "2026-11-20T10:00:00Z",
};

describe("CleanDataTelemetryStrip, CleanDataModal, and useConnectionsActions", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("shows — for Clean Records instead of raw recordsCount when cleanData is null", () => {
    const html = renderToStaticMarkup(
      React.createElement(CleanDataTelemetryStrip, {
        cleanData: null,
        recordsCount: 100000,
        verifiedCount: 0,
        needsReviewCount: 0,
        rejectedCount: 0,
        cleanSearchFilter: "",
        onSearchChange: () => {},
      }),
    );

    expect(html).toContain("Raw Records");
    expect(html).toContain("100000");
    expect(html).toContain("Clean Records");
    expect(html).toContain("—");
    const matches100k = html.match(/100000/g) ?? [];
    expect(matches100k).toHaveLength(1);
  });

  it("renders an explicit error state with Retry button when cleanDataError is set", () => {
    const html = renderToStaticMarkup(
      React.createElement(CleanDataModal, {
        cleanPreviewFile: SAMPLE_FILE,
        cleanData: null,
        cleanDataError: "Loading clean records timed out after 120s.",
        isCleanDataLoading: false,
        cleanSearchFilter: "",
        setCleanSearchFilter: () => {},
        onRetry: () => {},
        onClose: () => {},
      }),
    );

    expect(html).toContain("Failed to load clean records");
    expect(html).toContain("Loading clean records timed out after 120s.");
    expect(html).toContain("Retry");
    expect(html).not.toContain("No clean records returned for this dataset.");
  });

  it("passes timeoutMs: 120_000, populates cleanDataError on timeout/503, and retries cleanly", async () => {
    expect(CLEAN_PREVIEW_TIMEOUT_MS).toBe(120_000);

    let latestHook!: ReturnType<typeof useConnectionsActions>;
    const Harness: React.FC = () => {
      latestHook = useConnectionsActions({ loadConnectors: async () => {} });
      return null;
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    // 1. Timeout populates cleanDataError
    mockApiFetch.mockRejectedValueOnce(
      new ApiTimeoutError(
        120_000,
        "/api/v1/connections/conn-100k/clean-preview",
      ),
    );
    await act(async () => {
      await latestHook.handleInspectCleanData(SAMPLE_FILE);
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/connections/conn-100k/clean-preview",
      expect.objectContaining({
        timeoutMs: 120_000,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(latestHook.cleanData).toBeNull();
    expect(latestHook.cleanDataError).toContain("timed out after 120s");

    // 2. Retry succeeds and clears cleanDataError
    mockApiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          connectionId: "conn-100k",
          totalRawRecords: 100000,
          totalCleanRecords: 99800,
          duplicatesMerged: 200,
          compressionRatio: "0.2%",
          dataQualityScore: 99.8,
          status: "CLEANED",
          columns: ["id"],
          rows: [{ id: 1 }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await act(async () => {
      latestHook.retryCleanData();
    });

    expect(latestHook.cleanDataError).toBeNull();
    expect(latestHook.cleanData?.totalCleanRecords).toBe(99800);

    // 3. HTTP 503 with JSON error message populates cleanDataError
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(
        new Response(JSON.stringify({ error: "Data Engine overloaded" }), {
          status: 503,
        }),
      ),
    );
    await act(async () => {
      await latestHook.handleInspectCleanData(SAMPLE_FILE);
    });
    expect(latestHook.cleanDataError).toBe("Data Engine overloaded");

    // 4. Closing modal aborts in-flight request
    let capturedSignal: AbortSignal | undefined;
    mockApiFetch.mockImplementationOnce(
      (_url: string, init?: { signal?: AbortSignal }) => {
        capturedSignal = init?.signal;
        return new Promise(() => {});
      },
    );
    act(() => {
      void latestHook.handleInspectCleanData(SAMPLE_FILE);
    });
    expect(capturedSignal?.aborted).toBe(false);
    act(() => {
      latestHook.closeCleanPreview();
    });
    expect(capturedSignal?.aborted).toBe(true);
    expect(latestHook.cleanPreviewFile).toBeNull();
    expect(latestHook.cleanDataError).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("safely parses a truncated >2MB JSON array sample without crashing", () => {
    const truncated =
      '[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}, {"id": 3, "name": "Trun';
    const result = parseJSON(truncated, true);

    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ id: 1, name: "Alice" });
    expect(result.rows[1]).toEqual({ id: 2, name: "Bob" });
  });
});
