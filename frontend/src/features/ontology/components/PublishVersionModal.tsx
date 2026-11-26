import React, { useState, useEffect } from "react";
import { GitCommit, ICON_SIZES } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";

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
      setError("Version must follow semantic format (e.g. v1.0.0 or 1.0.0).");
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
          : "—",
        publishedBy: data.createdBy || "—",
        status: data.status || "PUBLISHED",
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish version.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !publishing) onClose();
      }}
      variant="form"
      title="Publish ontology version"
      description="Create a schema snapshot for version control and migration tracking."
      icon={
        <div className="w-9 h-9 rounded-full bg-success-bg border border-success-border flex items-center justify-center text-success shrink-0">
          <GitCommit size={ICON_SIZES.card} aria-hidden="true" />
        </div>
      }
      preventClose={publishing}
      statusMessage={publishing ? "Publishing ontology version..." : undefined}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={publishing}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="publish-ontology-version-form"
            variant="primary"
            size="sm"
            isLoading={publishing}
            disabled={publishing}
          >
            {publishing ? "Publishing..." : "Publish snapshot"}
          </Button>
        </>
      }
    >
      <form
        id="publish-ontology-version-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {error && (
          <div
            role="alert"
            className="px-3 py-2.5 bg-error-bg border border-error-border text-error text-xs rounded-lg"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="publish-version-tag"
            className="text-xs font-medium text-text"
          >
            Release semver tag
          </label>
          <input
            id="publish-version-tag"
            type="text"
            disabled={publishing}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g. v1.0.0"
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-border-focus font-mono disabled:opacity-50"
          />
          <span className="text-[11px] text-text-muted">
            Format: vMAJOR.MINOR.PATCH (e.g. v1.0.0, v1.1.0)
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="publish-version-changelog"
            className="text-xs font-medium text-text"
          >
            Changelog summary
          </label>
          <textarea
            id="publish-version-changelog"
            rows={3}
            disabled={publishing}
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="Describe model changes, added entities or property modifications..."
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-border-focus resize-none disabled:opacity-50"
          />
        </div>
      </form>
    </Dialog>
  );
};
