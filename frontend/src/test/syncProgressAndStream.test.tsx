import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatStartTime,
  formatOutcomeSummary,
  parseSyncDatasetFromApi,
  resolveSourceType,
  resolvePipelineTypeLabel,
} from "../features/connections/components/sync-job/syncJobHelpers";
import { SyncJobDetails } from "../features/connections/components/SyncJobDetails";

describe("Sync progress panel", () => {
  it("defaults stats scope to the most recent dataset and matches its own numbers", () => {
    const ds1 = parseSyncDatasetFromApi(
      {
        id: "run-11111111-aaaa",
        connectorName: "patients_nov20.csv",
        connectorType: "FILE",
        pipelineType: "FILE_INGESTION",
        status: "COMPLETED",
        recordsInput: 870,
        recordsOutput: 840,
        recordsFailed: 5,
        recordsQuarantined: 25,
        throughput: 56,
        durationSeconds: 15,
        startedAt: "2026-11-20T15:47:00Z",
        completedAt: "2026-11-20T15:47:15Z",
      },
      0,
    );
    const ds2 = parseSyncDatasetFromApi(
      {
        id: "run-22222222-bbbb",
        connectorName: "orders_prod",
        connectorType: "POSTGRESQL",
        pipelineType: "FILE_INGESTION",
        status: "COMPLETED",
        recordsInput: 100000,
        recordsOutput: 100000,
        recordsFailed: 0,
        throughput: 1200,
        durationSeconds: 83,
        startedAt: "2026-11-19T10:15:00Z",
        completedAt: "2026-11-19T10:16:23Z",
      },
      1,
    );

    const html = renderToStaticMarkup(
      React.createElement(SyncJobDetails, { datasets: [ds1, ds2] }),
    );

    // Scope header & caption match ds1 (not totals)
    expect(html).toContain("Sync: patients_nov20.csv");
    expect(html).toContain("1 dataset");
    expect(html).toContain("840 of 870 records");
    expect(html).toContain("Completed in 15s");
    // Finished run shows plain "Avg speed" with no sparkline polyline
    expect(html).toContain("Avg speed");
    expect(html).not.toContain("<polyline");
    // Honest outcome for rejected + quarantined rows
    expect(html).toContain("Completed with issues");
    expect(html).toContain("Loaded 840 - Quarantined 25 - Rejected 5");
    expect(html).toContain("5 rejected, 25 quarantined");
    // Toggle to all sync activity is available
    expect(html).toContain("All sync activity");
    // Run IDs visible so duplicates are distinguishable
    expect(html).toContain("#run-1111");
    expect(html).toContain("#run-2222");
  });

  it("never renders FILE_INGESTION with a contradicting Database type tag", () => {
    expect(resolveSourceType("FILE", "FILE_INGESTION", "patients.csv")).toBe(
      "File",
    );
    expect(
      resolveSourceType("Database", "FILE_INGESTION", "patients.csv"),
    ).toBe("File");
    expect(resolveSourceType("POSTGRESQL", "FILE_INGESTION", "orders_db")).toBe(
      "Database",
    );
    expect(resolvePipelineTypeLabel("FILE_INGESTION", "File")).toBe(
      "File ingestion",
    );
    expect(
      resolvePipelineTypeLabel("FILE_INGESTION", "Database"),
    ).toBeUndefined();

    const dbRun = parseSyncDatasetFromApi(
      {
        id: "run-db-1",
        connectorName: "orders_db",
        connectorType: "POSTGRESQL",
        pipelineType: "FILE_INGESTION",
        status: "COMPLETED",
        recordsInput: 500,
        recordsOutput: 500,
        recordsFailed: 0,
        durationSeconds: 10,
        startedAt: "2026-11-20T12:00:00Z",
      },
      0,
    );
    const html = renderToStaticMarkup(
      React.createElement(SyncJobDetails, { datasets: [dbRun] }),
    );
    expect(html).not.toContain("FILE_INGESTION");
    expect(html).not.toContain("File ingestion");
    expect(html).toContain("Database");
    // Explicitly reported 0 errors includes rejected count
    expect(html).toContain("0 rejected");
  });

  it("formats start times as Today HH:mm or Mon D, HH:mm", () => {
    const now = new Date(2026, 10, 20, 17, 0, 0);
    const today = new Date(2026, 10, 20, 15, 47, 0);
    const yesterday = new Date(2026, 10, 19, 15, 47, 0);

    expect(formatStartTime(today, now)).toBe("Today 15:47");
    expect(formatStartTime(yesterday, now)).toBe("Nov 19, 15:47");
    expect(formatStartTime(null, now)).toBe("–");
  });

  it("formats outcome summaries honestly for clean, rejected, and quarantined runs", () => {
    expect(
      formatOutcomeSummary({
        syncedRecords: 840,
        totalRecords: 870,
        quarantinedRecords: 25,
        rejectedRecords: 5,
      }),
    ).toBe("Loaded 840 - Quarantined 25 - Rejected 5");

    expect(
      formatOutcomeSummary({
        syncedRecords: 100,
        totalRecords: 100,
        rejectedRecords: 0,
      }),
    ).toBe("100 / 100 records");
  });
});
