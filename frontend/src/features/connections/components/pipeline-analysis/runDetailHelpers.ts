import type { PipelineRunItem, EngineJobDetail } from "./pipelineAnalysisTypes";

export interface ResolvedRunStatus {
  isFailed: boolean;
  hasIssues: boolean;
  statusDisplayLabel: string;
  failedStep: string | null;
  errorMessage: string | null;
}

export function resolveRunStatusDisplay(
  run: PipelineRunItem,
  jobDetail: EngineJobDetail | null,
): ResolvedRunStatus {
  const isFailed = run.status === "FAILED" || Boolean(jobDetail?.error);
  const hasIssues =
    !isFailed &&
    (run.status === "COMPLETED" ||
      run.status === "CLEANED" ||
      run.status === "VALIDATED") &&
    run.recordsFailed > 0;

  const statusDisplayLabel = isFailed
    ? "Failed"
    : hasIssues
      ? "Completed with issues"
      : run.status === "COMPLETED"
        ? "Completed"
        : run.status === "RUNNING"
          ? "Syncing"
          : run.status;

  const failedStep =
    jobDetail?.failed_step || (isFailed ? "data_cleaning" : null);

  const errorMessage =
    jobDetail?.error ||
    run.errorMessage ||
    (isFailed ? "Step execution halted due to error" : null);

  return {
    isFailed,
    hasIssues,
    statusDisplayLabel,
    failedStep,
    errorMessage,
  };
}

export function getSuggestedFix(errorMessage: string | null): string {
  if (!errorMessage) return "Review source records and schema mapping.";
  const lower = errorMessage.toLowerCase();
  if (
    lower.includes("schema") ||
    lower.includes("column") ||
    lower.includes("missing")
  ) {
    return "Schema mismatch: verify source column names and type mappings in Schema Studio.";
  }
  if (
    lower.includes("connection") ||
    lower.includes("timeout") ||
    lower.includes("network")
  ) {
    return "Network timeout: check that the connector credentials and database endpoint are accessible.";
  }
  if (
    lower.includes("duplicate") ||
    lower.includes("primary key") ||
    lower.includes("unique")
  ) {
    return "Duplicate identifier detected: verify entity resolution deduplication rules.";
  }
  return "Check dead-letter quarantine topic for invalid records and retry the run.";
}
