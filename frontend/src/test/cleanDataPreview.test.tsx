import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { CleanDataModal } from "../pages/connections/connections/CleanDataModal";
import { CleanDataTelemetryStrip } from "../pages/connections/connections/CleanDataTelemetryStrip";
import { CleanDataTable } from "../pages/connections/connections/CleanDataTable";
import { CleanDataRowPanel } from "../pages/connections/connections/CleanDataRowPanel";
import {
  extractBusinessColumns,
  getRowReasons,
  getRowScores,
  toSentenceCaseHeader,
} from "../pages/connections/connections/cleanDataUtils";
import {
  CLEAN_PREVIEW_TIMEOUT_MS,
  useConnectionsActions,
} from "../pages/connections/connections/useConnectionsActions";
import { parseJSON } from "../features/connections/components/file-upload/fileUploadTypes";
import { ApiError, ApiTimeoutError } from "../lib/api";
import type {
  CleanDataResponse,
  IngestedFile,
} from "../pages/connections/connections/connectionsTypes";

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

vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }: { children: React.ReactNode }) => children,
  Portal: ({ children }: { children: React.ReactNode }) => children,
  Overlay: () => null,
  Content: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement("div", props, children),
  Title: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement> & {
    children: React.ReactNode;
  }) => React.createElement("h2", props, children),
  Description: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement> & {
    children: React.ReactNode;
  }) => React.createElement("p", props, children),
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

const MESSY_RESPONSE: CleanDataResponse = {
  connectionId: "conn-100k",
  totalRawRecords: 100,
  totalCleanRecords: 100,
  duplicatesMerged: 2,
  verifiedRecords: 98,
  needsReviewRecords: 1,
  rejectedRecords: 1,
  dataQualityScore: 96.4,
  status: "COMPLETED",
  columns: [
    "id",
    "full_name",
    "dob",
    "qualityState",
    "qualityScore",
    "confidenceScore",
  ],
  rows: [
    {
      id: "rec-001",
      full_name: "Alice Doe",
      dob: "1990-05-12",
      qualityState: "VERIFIED",
      qualityScore: 100,
      confidenceScore: 1.0,
      _validationErrors: [],
      _validationWarnings: [],
    },
    {
      id: "rec-002",
      full_name: "Bob Smith",
      dob: "2099-99-99",
      qualityState: "REJECTED",
      qualityScore: 100,
      confidenceScore: 1.0,
      _validationErrors: ["Field 'dob': invalid calendar date"],
      _validationWarnings: [],
    },
    {
      id: "rec-003",
      full_name: "Cara Lee",
      dob: "01/02/2020",
      qualityState: "NEEDS_REVIEW",
      qualityScore: 88,
      confidenceScore: 1.0,
      _validationErrors: [],
      _validationWarnings: [],
    },
  ],
};

describe("Semantic Clean Data View", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("shows — for Records after cleaning when cleanData is null and explains quarantined inclusion when loaded", () => {
    const nullHtml = renderToStaticMarkup(
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

    expect(nullHtml).toContain("Raw records");
    expect(nullHtml).toContain("100,000");
    expect(nullHtml).toContain("Records after cleaning");
    expect(nullHtml).toContain("Filter loaded rows");
    expect(nullHtml.match(/100,000/g) ?? []).toHaveLength(1);

    const loadedHtml = renderToStaticMarkup(
      React.createElement(CleanDataTelemetryStrip, {
        cleanData: MESSY_RESPONSE,
        recordsCount: 100,
        verifiedCount: 98,
        needsReviewCount: 1,
        rejectedCount: 1,
        cleanSearchFilter: "",
        onSearchChange: () => {},
      }),
    );

    expect(loadedHtml).toContain("(includes 1 quarantined)");
    expect(loadedHtml).toContain("Quality score");
    expect(loadedHtml).toContain("96%");
  });

  it("renders honest footer (no Audited claim), Cleaned data badge, Export scope, and error/Retry state", () => {
    const html = renderToStaticMarkup(
      React.createElement(CleanDataModal, {
        cleanPreviewFile: SAMPLE_FILE,
        cleanData: MESSY_RESPONSE,
        cleanDataError: null,
        isCleanDataLoading: false,
        cleanSearchFilter: "",
        setCleanSearchFilter: () => {},
        onRetry: () => {},
        onClose: () => {},
      }),
    );

    expect(html).toContain("Semantic clean data view");
    expect(html).toContain("Cleaned data");
    expect(html).not.toContain("Golden Records");
    expect(html).not.toContain("DAMA/ISO 25012 Audited");
    expect(html).not.toContain("All Records Verified");
    expect(html).toContain("Export 3 records");
    expect(html).toContain("1 quarantined");
    expect(html).toContain("1 need review");
    expect(html).toContain("Needs review (1)");
    expect(html).toContain("Quarantined (1)");

    const errHtml = renderToStaticMarkup(
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

    expect(errHtml).toContain("Failed to load clean records");
    expect(errHtml).toContain("Retry");
    expect(errHtml).not.toContain(
      "No clean records returned for this dataset.",
    );
  });

  it("groups quality into one right-pinned column, shows reasons or 'No reason provided', and renders row panel", () => {
    const bizCols = extractBusinessColumns(MESSY_RESPONSE.columns);
    expect(bizCols).toEqual(["id", "full_name", "dob"]);
    expect(toSentenceCaseHeader("full_name")).toBe("Full name");
    expect(toSentenceCaseHeader("dob")).toBe("DOB");
    expect(getRowScores(MESSY_RESPONSE.rows[0]).scoresDiffer).toBe(false);
    expect(getRowScores(MESSY_RESPONSE.rows[2]).scoresDiffer).toBe(true);
    expect(getRowReasons(MESSY_RESPONSE.rows[1])[0]).toEqual({
      field: "dob",
      problem: "invalid calendar date",
    });

    const tableHtml = renderToStaticMarkup(
      React.createElement(CleanDataTable, {
        rows: MESSY_RESPONSE.rows,
        visibleColumns: bizCols,
        showReasonColumn: true,
        sortColumn: null,
        sortDir: "asc",
        onSort: () => {},
        selectedRowIndex: null,
        onSelectRow: () => {},
        resetScrollKey: "test",
      }),
    );
    expect(tableHtml).toContain("DOB: invalid calendar date");
    expect(tableHtml).toContain("No reason provided");
    expect(tableHtml).toContain("Quarantined");
    expect(tableHtml).toContain("Needs review");

    const panelHtml = renderToStaticMarkup(
      React.createElement(CleanDataRowPanel, {
        row: MESSY_RESPONSE.rows[1],
        businessColumns: bizCols,
        onClose: () => {},
      }),
    );
    expect(panelHtml).toContain("Record details");
    expect(panelHtml).toContain("invalid calendar date");
  });

  it("passes timeoutMs: 120_000, populates cleanDataError on timeout/503, retries, and aborts on close", async () => {
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
    expect(latestHook.cleanDataError).toContain("timed out after 120s");

    mockApiFetch.mockRejectedValueOnce(
      new ApiError(
        new Response(JSON.stringify({ error: "Data Engine overloaded" }), {
          status: 503,
        }),
      ),
    );
    await act(async () => {
      latestHook.retryCleanData();
    });
    expect(latestHook.cleanDataError).toBe("Data Engine overloaded");

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
  });
});
