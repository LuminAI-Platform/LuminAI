import React, { useState, useRef, useEffect } from "react";
import { CheckCircle2, AlertCircle, Copy, Check } from "../../../../lib/icons";
import type { ClassifiedConnectionError } from "./dbConnectorUtils";
import type { TestConnectionResult } from "./ConnectorCredentials";

interface ConnectionFeedbackBannerProps {
  testResult: TestConnectionResult | null;
  connectionError: ClassifiedConnectionError | null;
}

export const ConnectionFeedbackBanner: React.FC<
  ConnectionFeedbackBannerProps
> = ({ testResult, connectionError }) => {
  const [copiedDetails, setCopiedDetails] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyError = async () => {
    if (!connectionError?.technicalDetails) return;
    try {
      await navigator.clipboard.writeText(connectionError.technicalDetails);
      setCopiedDetails(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedDetails(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <>
      {testResult && !connectionError && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-lg bg-success-bg border border-success-border text-success text-xs flex items-start gap-2.5"
        >
          <CheckCircle2
            className="w-4 h-4 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">
              Connection verified ({testResult.latencyMs} ms)
            </p>
            <p className="text-text-secondary mt-0.5">
              Found {testResult.schemaCount} schema
              {testResult.schemaCount === 1 ? "" : "s"} and{" "}
              {testResult.tableCount} table
              {testResult.tableCount === 1 ? "" : "s"}. Continue to choose
              tables.
            </p>
          </div>
        </div>
      )}

      {connectionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 bg-error-bg border border-error-border rounded-lg text-xs space-y-2"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="w-4 h-4 text-error shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-error">
                {connectionError.title}
              </p>
              <p className="text-text-secondary leading-relaxed">
                {connectionError.suggestion}
              </p>
            </div>
          </div>

          <details className="text-[11px] text-text-secondary pl-6">
            <summary className="cursor-pointer select-none hover:text-text transition-colors">
              Technical details
            </summary>
            <div className="mt-2 p-2.5 rounded bg-surface border border-border flex items-start justify-between gap-2">
              <code className="font-mono text-[11px] text-error break-all flex-1">
                {connectionError.technicalDetails}
              </code>
              <button
                type="button"
                onClick={handleCopyError}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-surface-subtle hover:bg-surface-hover text-text text-[11px] font-medium shrink-0 cursor-pointer"
              >
                {copiedDetails ? (
                  <>
                    <Check
                      className="w-3 h-3 text-success"
                      aria-hidden="true"
                    />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </details>
        </div>
      )}
    </>
  );
};
