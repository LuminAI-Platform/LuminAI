import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as api from "../lib/api";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("echarts", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

import {
  commitDatasetVersion,
  createDataset,
  createQualityRule,
  evaluateQualityRules,
  fetchDatasetPreview,
  fetchQualityRules,
  normalizeDataset,
  normalizeSchemaMetadata,
  runSqlQuery,
} from "../features/datasets/datasetApi";
import { DatasetProfilerTab } from "../pages/datasets/components/DatasetProfilerTab";
import { DatasetVersionsTab } from "../pages/datasets/components/DatasetVersionsTab";
import { SqlResultsTable } from "../pages/analytics/components/SqlResultsTable";
import type { Dataset } from "../features/datasets/types";

describe("Dataset Catalog normalization & API contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes legacy array schemaMetadata into Record<string, string>", () => {
    expect(normalizeSchemaMetadata(["id", "email", "age"])).toEqual({
      id: "string",
      email: "string",
      age: "string",
    });
    expect(normalizeSchemaMetadata('["id","name"]')).toEqual({
      id: "string",
      name: "string",
    });

    const ds = normalizeDataset({
      id: "ds-1",
      tenantId: "t-1",
      name: "customers",
      displayName: "Customers",
      layer: "RAW",
      projectType: "SOURCE",
      currentVersion: 1,
      rowCount: 10,
      byteSize: 2048,
      schemaMetadata: ["id", "email"],
      profilingSummary: '{"overallScore":92.5,"completeness":98}',
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    expect(ds.sizeBytes).toBe(2048);
    expect(ds.schemaMetadata).toEqual({ id: "string", email: "string" });
    expect(ds.profilingSummary?.overallScore).toBe(92.5);
  });

  it("runSqlQuery rejects responses whose status starts with ERROR", async () => {
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        columns: [],
        rows: [],
        totalRows: 0,
        executionTimeMs: 3,
        status: "ERROR: Catalog Error: Table dataset does not exist",
      }),
    } as Response);

    await expect(
      runSqlQuery({ query: "SELECT * FROM missing_tbl" }),
    ).rejects.toThrow("Catalog Error: Table dataset does not exist");
  });

  it("calls preview, createDataset, commitVersion, and quality rule endpoints", async () => {
    const fetchSpy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          datasetId: "ds-1",
          datasetName: "orders",
          columns: [{ name: "id", type: "integer" }],
          rows: [{ id: 1 }],
          totalRows: 100,
          previewCount: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "ds-2", name: "clean_orders" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "v2", versionNumber: 2 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "r1", ruleName: "id_not_null" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          datasetId: "ds-1",
          totalRules: 1,
          passedRules: 1,
          failedRules: 0,
          results: [],
        }),
      } as Response);

    const preview = await fetchDatasetPreview("ds-1", 50);
    expect(preview.rows[0].id).toBe(1);

    await createDataset({ name: "clean_orders", layer: "WORKING" });
    await commitDatasetVersion("ds-1", { commitMessage: "Snapshot 2" });
    await fetchQualityRules("ds-1");
    await createQualityRule("ds-1", {
      ruleName: "id_not_null",
      dimension: "COMPLETENESS",
      columnName: "id",
      ruleType: "NOT_NULL",
    });
    const evalSummary = await evaluateQualityRules("ds-1");
    expect(evalSummary.passedRules).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });
});

describe("Dataset Catalog & SQL UI Components", () => {
  it("renders Run EDA Profile CTA when profilingSummary is empty and handles click", async () => {
    const onRunEda = vi.fn();
    const emptyDataset: Dataset = {
      id: "ds-1",
      tenantId: "t-1",
      name: "orders",
      displayName: "Orders",
      layer: "RAW",
      projectType: "SOURCE",
      storageFormat: "CSV",
      currentVersion: 1,
      rowCount: 120,
      sizeBytes: 4096,
      status: "ACTIVE",
      schemaMetadata: { order_id: "string", amount: "float" },
      profilingSummary: {},
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(DatasetProfilerTab, {
          dataset: emptyDataset,
          schemaEntries: [
            ["order_id", "string"],
            ["amount", "float"],
          ],
          onRunEda,
        }),
      );
    });

    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Run EDA Profile"),
    );
    expect(btn).toBeTruthy();
    await act(async () => {
      btn?.click();
    });
    expect(onRunEda).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("formats missing committedBy safely in DatasetVersionsTab", () => {
    const qc = new QueryClient();
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(DatasetVersionsTab, {
          datasetId: "ds-1",
          currentRowCount: 100,
          versions: [
            {
              id: "v1",
              datasetId: "ds-1",
              versionNumber: 1,
              commitMessage: "Initial ingestion",
              rowCount: 100,
              sizeBytes: 100,
              storageUri: "tenant/raw/file.csv",
              committedBy: undefined as unknown as string,
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        }),
      ),
    );

    expect(html).toContain("System Sync");
    expect(html).not.toContain("undefined");
  });

  it("allows toggling Table and Chart modes in SqlResultsTable", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(SqlResultsTable, {
          queryResult: {
            columns: [
              { name: "country", dataType: "VARCHAR" },
              { name: "total", dataType: "DOUBLE" },
            ],
            rows: [
              { country: "GH", total: 150 },
              { country: "KE", total: 250 },
            ],
            rowCount: 2,
            totalCount: 2,
            executionTimeMs: 8,
            query: "SELECT country, total FROM dataset",
          },
        }),
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const barBtn = buttons.find((b) => b.textContent === "Bar");
    expect(barBtn).toBeTruthy();
    expect(buttons.some((b) => b.textContent === "Donut")).toBe(true);
    expect(buttons.some((b) => b.textContent === "Histogram")).toBe(true);

    await act(async () => {
      barBtn?.click();
    });
    expect(container.textContent).toContain("total by country");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
