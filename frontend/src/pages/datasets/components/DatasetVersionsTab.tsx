import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GitCommit } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { commitDatasetVersion } from "../../../features/datasets/datasetApi";
import type { DatasetVersion } from "../../../features/datasets/types";

interface DatasetVersionsTabProps {
  datasetId: string;
  currentRowCount?: number;
  versions: DatasetVersion[];
  onVersionCommitted?: () => void;
}

function formatCommitAuthor(committedBy?: string | null): string {
  if (!committedBy || committedBy === "undefined" || committedBy === "null") {
    return "System Sync";
  }
  if (/^[0-9a-f]{8}-/i.test(committedBy)) {
    return `User ${committedBy.slice(0, 8)}`;
  }
  return committedBy;
}

export const DatasetVersionsTab: React.FC<DatasetVersionsTabProps> = ({
  datasetId,
  currentRowCount,
  versions,
  onVersionCommitted,
}) => {
  const [commitMessage, setCommitMessage] = useState("");

  const commitMutation = useMutation({
    mutationFn: () =>
      commitDatasetVersion(datasetId, {
        commitMessage: commitMessage.trim() || "Manual snapshot commit",
        rowCount: currentRowCount,
      }),
    onSuccess: () => {
      setCommitMessage("");
      onVersionCommitted?.();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commitMutation.mutate();
        }}
        className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <input
          type="text"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Snapshot commit message (e.g. Post-cleaning baseline)..."
          className="flex-1 bg-surface-subtle border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-secondary focus:outline-hidden focus:border-primary"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={commitMutation.isPending}
          leftIcon={<GitCommit className="w-3.5 h-3.5" />}
        >
          Commit Snapshot
        </Button>
      </form>

      {commitMutation.isError && (
        <div className="p-3 rounded-lg border border-error/30 bg-error/10 text-error text-xs">
          {(commitMutation.error as Error)?.message ||
            "Failed to commit dataset version."}
        </div>
      )}

      {versions.length === 0 ? (
        <div className="p-8 text-center text-text-secondary text-sm border border-border rounded-xl bg-surface">
          No historical version snapshots recorded.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v, idx) => {
            const prev = versions[idx + 1];
            const rowDelta =
              prev != null ? (v.rowCount || 0) - (prev.rowCount || 0) : null;

            return (
              <div
                key={v.id}
                className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center font-mono font-bold text-xs text-primary shrink-0">
                    v{v.versionNumber}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-text">
                      {v.commitMessage || `Version ${v.versionNumber}`}
                    </span>
                    <span className="text-xs text-text-secondary">
                      Committed by{" "}
                      <span className="text-text font-medium">
                        {formatCommitAuthor(v.committedBy)}
                      </span>{" "}
                      on{" "}
                      {v.createdAt
                        ? new Date(v.createdAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-mono text-text">
                      {(v.rowCount || 0).toLocaleString()} rows
                    </span>
                    {rowDelta !== null && rowDelta !== 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          rowDelta > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {rowDelta > 0
                          ? `+${rowDelta.toLocaleString()}`
                          : rowDelta.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-secondary">
                    {v.storageUri ? "Snapshot stored" : "Metadata snapshot"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
