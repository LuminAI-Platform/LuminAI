import type { ActivityItem } from "./ActivityFeed";

export type ResolvedActivityStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_ISSUES"
  | "FAILED"
  | "RUNNING"
  | "QUEUED"
  | "INFO";

const GENERIC_RUN_TITLES = new Set([
  "data run",
  "file run",
  "ingestion run",
  "pipeline run",
  "run",
]);

export function formatRelativeTime(dateString: string): string {
  try {
    const ms = new Date(dateString).getTime();
    if (Number.isNaN(ms)) return dateString;
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateString;
  }
}

export function formatExactTimestamp(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function resolveActivityStatus(
  item: ActivityItem,
): ResolvedActivityStatus {
  const raw = (item.status || "").toUpperCase();
  const quarantined = item.recordsQuarantined ?? 0;
  const rejected = item.recordsRejected ?? 0;
  const failed = item.recordsFailed ?? 0;
  const hasIssues = quarantined > 0 || rejected > 0 || failed > 0;

  if (raw === "FAILED" || raw === "ERROR") return "FAILED";
  if (raw === "RUNNING" || raw === "INGESTING" || raw === "PROCESSING") {
    return "RUNNING";
  }
  if (raw === "QUEUED" || raw === "PENDING") return "QUEUED";
  if (raw === "COMPLETED_WITH_ISSUES") return "COMPLETED_WITH_ISSUES";
  if (
    raw === "SUCCESS" ||
    raw === "COMPLETED" ||
    raw === "CLEANED" ||
    raw === "VALIDATED"
  ) {
    return hasIssues ? "COMPLETED_WITH_ISSUES" : "COMPLETED";
  }
  return "INFO";
}

export function getActivityTitleInfo(item: ActivityItem): {
  title: string;
  runIdLabel?: string;
  secondaryTag?: string;
} {
  const cleanRunId = (item.runId || item.id || "").replace(/^run-/, "");
  const isPipelineRun = item.type === "PIPELINE_RUN";

  if (!isPipelineRun) {
    return {
      title: item.title?.trim() || "Untitled event",
    };
  }

  const explicitName = (item.datasetName || item.connectorName || "").trim();
  const rawTitle = (item.title || "").trim();
  const isGenericTitle =
    !rawTitle || GENERIC_RUN_TITLES.has(rawTitle.toLowerCase());
  const secondaryTag =
    !item.connectorType || item.connectorType.toUpperCase() === "FILE"
      ? "File ingestion"
      : `${item.connectorType} ingestion`;

  if (explicitName) {
    return { title: explicitName, secondaryTag };
  }
  if (!isGenericTitle) {
    return { title: rawTitle, secondaryTag };
  }
  return {
    title: "Untitled dataset",
    runIdLabel: cleanRunId ? `#${cleanRunId.slice(0, 8)}` : undefined,
    secondaryTag,
  };
}

export function formatActivitySubtitle(item: ActivityItem): string {
  const loaded = item.recordsLoaded;
  const quarantined = item.recordsQuarantined;
  const rejected = item.recordsRejected;

  if (loaded != null && quarantined != null && rejected != null) {
    return `Loaded ${loaded.toLocaleString()} - Quarantined ${quarantined.toLocaleString()} - Rejected ${rejected.toLocaleString()}`;
  }

  if (item.recordsOutput != null || loaded != null) {
    const count = loaded ?? item.recordsOutput ?? 0;
    return `${count.toLocaleString()} records processed`;
  }

  const desc = (item.description || "").trim();
  if (!desc) return "";

  const bothZeroExplicitly = quarantined === 0 && rejected === 0;
  if (!bothZeroExplicitly) {
    const processedMatch = desc.match(
      /^Processed\s+([\d,]+)\s+records\s+successfully\.?$/i,
    );
    if (processedMatch) {
      return `${processedMatch[1]} records processed`;
    }
    return desc.replace(/\s+successfully\b/gi, "");
  }

  return desc;
}

export interface PipelineRunSummary {
  id: string;
  connectorName?: string | null;
  connectorType?: string | null;
  pipelineType?: string | null;
  status?: string | null;
  recordsOutput?: number | null;
  recordsFailed?: number | null;
  recordsQuarantined?: number | null;
  recordsRejected?: number | null;
  startedAt?: string | null;
}

/**
 * Enriches dashboard activity items with real dataset/run fields already returned
 * by GET /api/v1/pipelines/runs (matching by full id or 8-char prefix).
 */
export function mergeActivityWithRuns(
  activities: ActivityItem[],
  runs: PipelineRunSummary[],
): ActivityItem[] {
  if (runs.length === 0) return activities;
  return activities.map((item) => {
    if (item.type !== "PIPELINE_RUN") return item;
    const prefix = (item.runId || item.id || "").replace(/^run-/, "");
    if (!prefix) return item;
    const match = runs.find((r) => r.id === prefix || r.id.startsWith(prefix));
    if (!match) return item;
    return {
      ...item,
      runId: match.id,
      datasetName: item.datasetName || match.connectorName || null,
      connectorName: item.connectorName || match.connectorName || null,
      connectorType: item.connectorType || match.connectorType || null,
      pipelineType: item.pipelineType || match.pipelineType || null,
      status: match.status || item.status,
      recordsOutput:
        item.recordsOutput ??
        (typeof match.recordsOutput === "number" ? match.recordsOutput : null),
      recordsFailed:
        item.recordsFailed ??
        (typeof match.recordsFailed === "number" ? match.recordsFailed : null),
      recordsQuarantined:
        item.recordsQuarantined ??
        (typeof match.recordsQuarantined === "number"
          ? match.recordsQuarantined
          : null),
      recordsRejected:
        item.recordsRejected ??
        (typeof match.recordsRejected === "number"
          ? match.recordsRejected
          : null),
    };
  });
}

/**
 * Resolves the destination route and optional fragment anchor for an activity item.
 */
export function getActivityTargetRoute(item: ActivityItem): {
  to: string;
  hash?: string;
} {
  if (item.link) {
    return { to: item.link };
  }
  switch (item.type) {
    case "PIPELINE_RUN": {
      const cleanId = (item.runId || item.id).replace(/^run-/, "");
      return {
        to: "/connections/pipelines",
        hash: `pipeline-job-${cleanId}`,
      };
    }
    case "CONNECTION_CREATE":
      return { to: "/connections" };
    case "ENTITY_SYNC":
      return { to: "/explorer" };
    case "ONTOLOGY_UPDATE":
      return { to: "/ontology" };
    default:
      return { to: "/connections/pipelines" };
  }
}
