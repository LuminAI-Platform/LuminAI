import { useState, useEffect } from "react";
import { apiFetch } from "../../../../lib/api";
import type { PipelineRunItem, EngineJobDetail } from "./pipelineAnalysisTypes";

export function useRunDetailData(
  propRun: PipelineRunItem | null,
  runId?: string | null,
) {
  const [fetchedRun, setFetchedRun] = useState<PipelineRunItem | null>(null);
  const [jobDetail, setJobDetail] = useState<EngineJobDetail | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const run = propRun ?? fetchedRun;
  const activeRunId = propRun?.id ?? runId ?? null;

  useEffect(() => {
    if (propRun || !runId) {
      setFetchedRun(null);
      return;
    }

    let isMounted = true;
    apiFetch(`/api/v1/pipelines/runs/${encodeURIComponent(runId)}`, {
      headers: { "X-Suppress-Toast": "true" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setFetchedRun(data as PipelineRunItem);
        }
      })
      .catch(() => {
        // Ignore if run lookup fails
      });

    return () => {
      isMounted = false;
    };
  }, [propRun, runId]);

  useEffect(() => {
    if (!activeRunId) {
      setJobDetail(null);
      return;
    }

    let isMounted = true;

    apiFetch(`/api/v1/engine/process/jobs/${activeRunId}`, {
      headers: { "X-Suppress-Toast": "true" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setJobDetail(data);
        }
      })
      .catch(() => {
        // Fallback to run object info
      });

    return () => {
      isMounted = false;
    };
  }, [activeRunId]);

  const isFailed = run
    ? run.status === "FAILED" || Boolean(jobDetail?.error)
    : false;
  const hasIssues =
    !isFailed &&
    run &&
    (run.status === "COMPLETED" ||
      run.status === "CLEANED" ||
      run.status === "VALIDATED") &&
    run.recordsFailed > 0;

  const statusDisplayLabel = isFailed
    ? "Failed"
    : hasIssues
      ? "Completed with issues"
      : run?.status === "COMPLETED"
        ? "Completed"
        : run?.status === "RUNNING"
          ? "Syncing"
          : (run?.status ?? "");

  const failedStep = jobDetail?.failed_step ?? null;
  const errorMessage =
    jobDetail?.error ||
    run?.errorMessage ||
    (isFailed ? "Step execution halted due to error" : null);

  const getSuggestedFix = () => {
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
  };

  const handleRetry = async () => {
    if (!run) return;
    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const res = await apiFetch(`/api/v1/engine/process/retry/${run.id}`, {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
      });
      if (res.ok) {
        setRetryMessage("Pipeline run scheduled for retry.");
      } else {
        setRetryMessage(`Retry request failed (HTTP ${res.status}).`);
      }
    } catch {
      setRetryMessage("Failed to submit retry request to data engine.");
    } finally {
      setIsRetrying(false);
    }
  };

  return {
    run,
    activeRunId,
    jobDetail,
    isFailed,
    hasIssues,
    statusDisplayLabel,
    failedStep,
    errorMessage,
    getSuggestedFix,
    isRetrying,
    retryMessage,
    handleRetry,
  };
}
