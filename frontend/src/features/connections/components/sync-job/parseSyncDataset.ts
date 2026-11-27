import type { PipelineRunItem } from "../pipeline-analysis/pipelineAnalysisTypes";
import type { SyncDataset } from "./syncJobTypes";
import {
  parseMetadataJson,
  readOptionalNumber,
  resolveSourceType,
  resolvePipelineTypeLabel,
  resolveSyncStatus,
} from "./syncJobHelpers";

export function parseSyncDatasetFromApi(
  item: Record<string, unknown>,
  index: number,
): SyncDataset {
  const id = String(item.id ?? `run-${index}`);
  const meta = parseMetadataJson(item.metadata);
  const metaFileName =
    typeof meta?.fileName === "string" && meta.fileName.trim()
      ? meta.fileName.trim()
      : undefined;

  const rawConnectorName =
    typeof item.connectorName === "string" && item.connectorName.trim()
      ? item.connectorName.trim()
      : undefined;

  const name = rawConnectorName ?? metaFileName ?? `Dataset ${index + 1}`;
  const rawConnectorType =
    typeof item.connectorType === "string" ? item.connectorType : undefined;
  const rawPipelineType =
    typeof item.pipelineType === "string" ? item.pipelineType : undefined;

  const sourceType = resolveSourceType(rawConnectorType, rawPipelineType, name);
  const pipelineTypeLabel = resolvePipelineTypeLabel(
    rawPipelineType,
    sourceType,
  );

  const totalRecords = readOptionalNumber(item.recordsInput);
  const syncedRecords = readOptionalNumber(item.recordsOutput);
  const rejectedRecords =
    readOptionalNumber(item.recordsRejected) ??
    readOptionalNumber(meta?.rejectedRecords) ??
    readOptionalNumber(meta?.recordsRejected) ??
    readOptionalNumber(item.recordsFailed);
  const quarantinedRecords =
    readOptionalNumber(item.recordsQuarantined) ??
    readOptionalNumber(item.quarantinedRecords) ??
    readOptionalNumber(meta?.quarantinedRecords) ??
    readOptionalNumber(meta?.recordsQuarantined);

  const rawStatus = String(item.status ?? "COMPLETED").toUpperCase();
  const status = resolveSyncStatus(
    rawStatus,
    rejectedRecords,
    quarantinedRecords,
    totalRecords,
    syncedRecords,
  );

  const startedAt = item.startedAt ? new Date(String(item.startedAt)) : null;
  const completedAt = item.completedAt
    ? new Date(String(item.completedAt))
    : null;

  const apiDuration = readOptionalNumber(item.durationSeconds);
  let durationSeconds = apiDuration;
  if (
    durationSeconds === undefined &&
    startedAt &&
    completedAt &&
    !Number.isNaN(startedAt.getTime()) &&
    !Number.isNaN(completedAt.getTime())
  ) {
    durationSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000),
    );
  }

  const throughput = readOptionalNumber(item.throughput);

  const rawRun: PipelineRunItem = {
    id,
    connectionId: item.connectionId ? String(item.connectionId) : undefined,
    connectorName: name,
    connectorType: sourceType,
    pipelineType: rawPipelineType ?? "",
    status: rawStatus,
    progress: readOptionalNumber(item.progress) ?? 0,
    recordsInput: totalRecords ?? 0,
    recordsOutput: syncedRecords ?? 0,
    recordsFailed: rejectedRecords ?? 0,
    throughput: throughput ?? 0,
    startedAt: startedAt ? startedAt.toISOString() : new Date().toISOString(),
    completedAt: completedAt ? completedAt.toISOString() : null,
    durationSeconds: durationSeconds ?? 0,
    errorMessage:
      typeof item.errorMessage === "string" ? item.errorMessage : null,
    metadata:
      typeof item.metadata === "string"
        ? item.metadata
        : item.metadata
          ? JSON.stringify(item.metadata)
          : null,
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
  };

  return {
    id,
    connectionId: rawRun.connectionId,
    name,
    fileName: metaFileName,
    pipelineTypeLabel,
    sourceType,
    rawConnectorType: rawConnectorType ?? sourceType,
    totalRecords,
    syncedRecords,
    rejectedRecords,
    quarantinedRecords,
    status,
    rawStatus,
    startedAt,
    completedAt,
    durationSeconds,
    throughput:
      throughput !== undefined && throughput > 0 ? throughput : undefined,
    errorMessage: rawRun.errorMessage,
    metadata: rawRun.metadata,
    rawRun,
  };
}
