import React, { useState, useEffect } from "react";
import { GitCommit, Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";

interface PublishVersionModalProps {
  open: boolean;
  defaultVersion: string;
  onClose: () => void;
  onPublished: (versionObj: {
    id: string;
    version: string;
    publishedAt: string;
    publishedBy: string;
    status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
  }) => void;
}

export const PublishVersionModal: React.FC<PublishVersionModalProps> = ({
  open,
  defaultVersion,
  onClose,
  onPublished,
}) => {
  const [version, setVersion] = useState(defaultVersion);
  const [changelog, setChangelog] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVersion(defaultVersion);
    setChangelog(`Published ontology schema release ${defaultVersion}`);
    setError(null);
  }, [defaultVersion, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version.trim()) {
      setError("Version tag is required.");
      return;
    }
    if (!/^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(version.trim())) {
      setError("Version must follow semantic format (e.g. v1.0.0 or 1.0.0)");
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/ontology/versions", {
        method: "POST",
        body: JSON.stringify({
          version: version.trim(),
          changelog: changelog.trim() || `Release ${version.trim()}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.message || `Publish rejected (HTTP ${res.status})`,
        );
      }

      const data = await res.json();
      onPublished({
        id: data.id,
        version: data.version,
        publishedAt: data.publishedAt
          ? new Date(data.publishedAt).toLocaleString()
          : new Date().toLocaleString(),
        publishedBy: data.createdBy || "System Admin",
        status: data.status || "PUBLISHED",
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish version",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      maxWidth="lg"
      hideHeader={true}
    >
      <div className="flex flex-col bg-zinc-950 text-zinc-100 p-6 select-none">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <GitCommit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Publish Ontology Version Snapshot
            </h2>
            <p className="text-[11px] text-zinc-500">
              Create an immutable schema snapshot for version control and
              migration tracking
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
              Release Semver Tag
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. v1.0.0"
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Format: vMAJOR.MINOR.PATCH (e.g. v1.0.0, v1.1.0)
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
              Changelog Summary
            </label>
            <textarea
              rows={3}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Describe model changes, added entities or property modifications..."
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={publishing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Publish Snapshot
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
