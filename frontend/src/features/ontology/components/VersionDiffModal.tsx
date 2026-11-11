import React, { useState, useEffect } from "react";
import { GitCompare, Loader2, Plus, Minus, CheckCircle } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";

interface VersionDiffModalProps {
  open: boolean;
  versionId: string;
  versionTag: string;
  onClose: () => void;
}

interface DiffResponse {
  currentVersion: string;
  previousVersion: string;
  addedEntityTypes: string[];
  modifiedEntityTypes: string[];
  removedEntityTypes: string[];
  addedRelationshipTypes: string[];
  removedRelationshipTypes: string[];
}

export const VersionDiffModal: React.FC<VersionDiffModalProps> = ({
  open,
  versionId,
  versionTag,
  onClose,
}) => {
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !versionId) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/v1/ontology/versions/${versionId}/diff`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: DiffResponse) => setDiff(data))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load version diff",
        ),
      )
      .finally(() => setLoading(false));
  }, [open, versionId]);

  const hasChanges =
    diff &&
    ((diff.addedEntityTypes && diff.addedEntityTypes.length > 0) ||
      (diff.removedEntityTypes && diff.removedEntityTypes.length > 0) ||
      (diff.addedRelationshipTypes && diff.addedRelationshipTypes.length > 0) ||
      (diff.removedRelationshipTypes &&
        diff.removedRelationshipTypes.length > 0));

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      maxWidth="lg"
      hideHeader={true}
    >
      <div className="flex flex-col bg-zinc-950 text-zinc-100 p-6 select-none">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Ontology Schema Release Diff
              </h2>
              <p className="text-[11px] text-zinc-500">
                Comparing{" "}
                <span className="text-zinc-300 font-mono font-bold">
                  {versionTag}
                </span>{" "}
                against predecessor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="py-5">
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-zinc-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span>Calculating release diff…</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          ) : !hasChanges ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
              <span className="text-xs font-semibold text-zinc-200">
                No Breaking Schema Changes
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5">
                Baseline version matches previous release or initial release
                definition
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 text-xs">
              <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between">
                <span>
                  Base:{" "}
                  <strong className="text-zinc-200 font-mono">
                    {diff?.previousVersion}
                  </strong>
                </span>
                <span>
                  Current:{" "}
                  <strong className="text-purple-400 font-mono">
                    {diff?.currentVersion}
                  </strong>
                </span>
              </div>

              {/* Added Entities */}
              {diff?.addedEntityTypes && diff.addedEntityTypes.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1.5">
                    + Added Entity Types ({diff.addedEntityTypes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.addedEntityTypes.map((e) => (
                      <span
                        key={e}
                        className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      >
                        <Plus className="w-3 h-3" />
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed Entities */}
              {diff?.removedEntityTypes &&
                diff.removedEntityTypes.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider block mb-1.5">
                      - Removed Entity Types ({diff.removedEntityTypes.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {diff.removedEntityTypes.map((e) => (
                        <span
                          key={e}
                          className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20"
                        >
                          <Minus className="w-3 h-3" />
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Added Relationships */}
              {diff?.addedRelationshipTypes &&
                diff.addedRelationshipTypes.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block mb-1.5">
                      + Added Relationship Types (
                      {diff.addedRelationshipTypes.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {diff.addedRelationshipTypes.map((r) => (
                        <span
                          key={r}
                          className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        >
                          <Plus className="w-3 h-3" />
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Removed Relationships */}
              {diff?.removedRelationshipTypes &&
                diff.removedRelationshipTypes.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider block mb-1.5">
                      - Removed Relationship Types (
                      {diff.removedRelationshipTypes.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {diff.removedRelationshipTypes.map((r) => (
                        <span
                          key={r}
                          className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        >
                          <Minus className="w-3 h-3" />
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
