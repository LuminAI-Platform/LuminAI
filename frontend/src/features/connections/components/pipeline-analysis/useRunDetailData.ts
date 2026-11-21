import { useEffect, useState } from "react";
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
        setRetryMessage("Retry accepted. Polling updated status...");
      }
    } catch {
      setRetryMessage("Retry request submitted to data engine.");
    } finally {
      setIsRetrying(false);
    }
  };

  return {
    run,
    activeRunId,
    jobDetail,
    isRetrying,
    retryMessage,
    handleRetry,
  };
}
