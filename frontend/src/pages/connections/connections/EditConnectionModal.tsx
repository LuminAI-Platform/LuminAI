import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Button } from "../../../components/ui/Button";
import { formatExactTimestamp, type UnifiedSource } from "./connectionsTypes";

const MAX_CONNECTION_NAME_LENGTH = 100;

interface EditConnectionModalProps {
  source: UnifiedSource | null;
  existingSources: UnifiedSource[];
  isSaving: boolean;
  isTesting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSave: (newName: string) => void;
  onTestConnection?: (
    source: UnifiedSource,
  ) => Promise<{ ok: boolean; message: string }>;
}

export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({
  source,
  existingSources,
  isSaving,
  isTesting,
  errorMessage,
  onClose,
  onSave,
  onTestConnection,
}) => {
  const [name, setName] = useState(source?.name ?? "");
  const [touched, setTouched] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setName(source?.name ?? "");
    setTouched(false);
    setShowDiscardConfirm(false);
    setTestResult(null);
  }, [source]);

  const trimmedName = name.trim();
  const isDirty = source !== null && trimmedName !== source.name;

  const validationError = useMemo(() => {
    if (!source) return null;
    if (!trimmedName) return "Source name is required.";
    if (trimmedName.length > MAX_CONNECTION_NAME_LENGTH) {
      return `Source name must be ${MAX_CONNECTION_NAME_LENGTH} characters or fewer.`;
    }
    const lower = trimmedName.toLowerCase();
    const isDuplicate = existingSources.some(
      (item) =>
        item.id !== source.id && item.name.trim().toLowerCase() === lower,
    );
    if (isDuplicate) {
      return "A connection with this name already exists.";
    }
    return null;
  }, [source, trimmedName, existingSources]);

  const canSave = isDirty && !validationError && !isSaving;

  const summaryRows = useMemo(() => {
    if (!source) return [];
    const rows: { label: string; value: string }[] = [
      { label: "Type", value: source.typeLabel },
    ];
    if (source.category === "database" && source.host) {
      rows.push({ label: "Host", value: source.host });
    } else if (source.category === "file" && source.fileName) {
      rows.push({ label: "File name", value: source.fileName });
    }
    if (source.createdAt) {
      const created = formatExactTimestamp(source.createdAt);
      if (created) rows.push({ label: "Created", value: created });
    }
    if (source.lastSyncAt) {
      const lastSync = formatExactTimestamp(source.lastSyncAt);
      if (lastSync) rows.push({ label: "Last sync", value: lastSync });
    }
    return rows;
  }, [source]);

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSave) return;
    onSave(trimmedName);
  };

  const handleTest = async () => {
    if (!source || !onTestConnection || isTesting) return;
    setTestResult(null);
    setTestResult(await onTestConnection(source));
  };

  return (
    <>
      <Dialog
        open={!!source}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        onRequestClose={requestClose}
        preventClose={isSaving}
        variant="form"
        title="Edit connection"
        description={source ? `Update settings for ${source.name}.` : undefined}
        statusMessage={
          isSaving
            ? "Saving connection changes..."
            : isTesting
              ? "Testing connection..."
              : undefined
        }
        footerStart={
          source?.category === "database" && onTestConnection ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isTesting}
              disabled={isSaving || isTesting}
              onClick={handleTest}
            >
              {isTesting ? "Testing..." : "Test connection"}
            </Button>
          ) : undefined
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={requestClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-connection-form"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              disabled={!canSave}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </>
        }
      >
        <form
          id="edit-connection-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-connection-name"
              className="block text-xs font-medium text-text"
            >
              Source name
            </label>
            <input
              id="edit-connection-name"
              type="text"
              maxLength={MAX_CONNECTION_NAME_LENGTH + 1}
              disabled={isSaving}
              value={name}
              aria-invalid={touched && !!validationError}
              aria-describedby={
                touched && validationError
                  ? "edit-connection-name-error"
                  : undefined
              }
              onChange={(e) => {
                setName(e.target.value);
                if (!touched) setTouched(true);
              }}
              onBlur={() => setTouched(true)}
              className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text focus:outline-none disabled:opacity-50 ${
                touched && validationError
                  ? "border-error focus:border-error"
                  : "border-border focus:border-border-focus"
              }`}
            />
            {touched && validationError && (
              <p
                id="edit-connection-name-error"
                role="alert"
                className="text-xs text-error"
              >
                {validationError}
              </p>
            )}
          </div>

          {summaryRows.length > 0 && (
            <dl className="rounded-lg border border-border bg-surface-subtle/60 p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {summaryRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-text-muted">{row.label}</dt>
                  <dd
                    className="text-text font-medium truncate mt-0.5"
                    title={row.value}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {testResult && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-lg border px-3 py-2.5 text-xs ${
                testResult.ok
                  ? "border-success-border bg-success-bg text-success"
                  : "border-error-border bg-error-bg text-error"
              }`}
            >
              {testResult.message}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-error-border bg-error-bg px-3 py-2.5 text-xs text-error"
            >
              {errorMessage}
            </div>
          )}
        </form>
      </Dialog>

      <ConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="Discard changes?"
        description="Your unsaved changes to this connection will be lost."
        confirmText="Discard"
        cancelText="Keep editing"
        isDestructive={true}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
      />
    </>
  );
};
