import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Icons, ICON_SIZES } from "../../../lib/icons";
import type { UnifiedSource } from "./connectionsTypes";

interface DeleteConnectionDialogProps {
  source: UnifiedSource | null;
  isDeleting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConnectionDialog: React.FC<DeleteConnectionDialogProps> = ({
  source,
  isDeleting,
  errorMessage,
  onClose,
  onConfirm,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    setTypedName("");
  }, [source?.id]);

  const configuredPipelines = source?.configuredPipelines ?? 0;
  const hasActivePipelines =
    source?.status === "Syncing" || configuredPipelines > 0;
  const hasImportedData = (source?.rowsSynced ?? 0) > 0;
  const requiresTypedConfirmation = hasActivePipelines || hasImportedData;

  const isConfirmEnabled =
    !isDeleting &&
    (!requiresTypedConfirmation ||
      (source !== null && typedName.trim() === source.name));

  const consequences: string[] = [];
  if (configuredPipelines > 0) {
    consequences.push(
      `${configuredPipelines} sync ${configuredPipelines === 1 ? "pipeline" : "pipelines"} will be stopped.`,
    );
  } else if (source?.status === "Syncing") {
    consequences.push("Active sync pipeline will be stopped.");
  }
  consequences.push("Data already imported is kept.");

  return (
    <Dialog
      open={!!source}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onClose();
      }}
      variant="destructive"
      title="Delete connection?"
      description={
        source ? `${source.name} will be permanently deleted.` : undefined
      }
      icon={
        <div className="w-9 h-9 rounded-full bg-error-bg text-error border border-error-border flex items-center justify-center shrink-0">
          <Icons.Trash2 size={ICON_SIZES.card} aria-hidden="true" />
        </div>
      }
      preventClose={isDeleting}
      initialFocusRef={cancelBtnRef}
      statusMessage={isDeleting ? "Deleting connection..." : undefined}
      footer={
        <>
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="secondary"
            size="sm"
            disabled={isDeleting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            isLoading={isDeleting}
            disabled={!isConfirmEnabled}
            onClick={onConfirm}
          >
            {isDeleting
              ? "Deleting..."
              : errorMessage
                ? "Retry"
                : "Delete connection"}
          </Button>
        </>
      }
    >
      {source && (
        <div className="flex flex-col gap-4">
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-text-secondary leading-relaxed">
            {consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {requiresTypedConfirmation && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="delete-connection-confirm-input"
                className="text-xs font-medium text-text"
              >
                Type{" "}
                <span className="font-mono font-semibold text-text">
                  {source.name}
                </span>{" "}
                to confirm
              </label>
              <input
                id="delete-connection-confirm-input"
                type="text"
                autoComplete="off"
                disabled={isDeleting}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={source.name}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-border-focus disabled:opacity-50"
              />
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
        </div>
      )}
    </Dialog>
  );
};
