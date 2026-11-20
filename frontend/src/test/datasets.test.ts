import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchDatasets,
  fetchDatasetById,
  runSqlQuery,
  trainMlModel,
} from "../features/datasets/datasetApi";
import * as api from "../lib/api";

describe("Dataset & Analytics API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchDatasets queries datasets with layer and search filters", async () => {
    const mockDatasets = [
      {
        id: "ds-1",
        name: "customers_raw",
        displayName: "Raw Customers",
        layer: "RAW",
        projectType: "SOURCE",
        rowCount: 1000,
        qualityScore: 92.5,
      },
    ];

    const spy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockDatasets,
    } as Response);

    const result = await fetchDatasets({ layer: "RAW", search: "customers" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/datasets?layer=RAW&search=customers"),
    );
    expect(result).toEqual(mockDatasets);
  });

  it("fetchDatasetById retrieves single dataset by ID", async () => {
    const mockDataset = {
      id: "ds-123",
      name: "orders_curated",
      displayName: "Curated Orders",
      layer: "CURATED",
    };

    const spy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockDataset,
    } as Response);

    const result = await fetchDatasetById("ds-123");
    expect(spy).toHaveBeenCalledWith("/api/v1/datasets/ds-123");
    expect(result.displayName).toBe("Curated Orders");
  });

  it("runSqlQuery sends query and returns execution results", async () => {
    const mockQueryResult = {
      columns: [{ name: "id", data_type: "BIGINT" }],
      rows: [{ id: 1 }],
      rowCount: 1,
      totalCount: 1,
      executionTimeMs: 4.2,
      query: "SELECT 1 AS id",
    };

    const spy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueryResult,
    } as Response);

    const result = await runSqlQuery({ query: "SELECT 1 AS id" });
    expect(spy).toHaveBeenCalledWith("/api/v1/datasets/sql", expect.anything());
    expect(result.executionTimeMs).toBe(4.2);
    expect(result.rows[0].id).toBe(1);
  });

  it("trainMlModel posts experiment payload to ML Studio endpoint", async () => {
    const mockOutcome = {
      metrics: { accuracy: 0.95 },
      run_id: "run-xyz-123",
    };

    const spy = vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockOutcome,
    } as Response);

    const result = await trainMlModel({
      model_name: "Test Classifier",
      dataset_name: "test_ds",
      dataset_version: 1,
      target_column: "label",
      records: [{ x: 1, label: 1 }],
      algorithm: "Random Forest",
      task_type: "CLASSIFICATION",
    });

    expect(spy).toHaveBeenCalledWith("/analytics/ml/train", expect.anything());
    expect(result.run_id).toBe("run-xyz-123");
    expect(result.metrics.accuracy).toBe(0.95);
  });
});
