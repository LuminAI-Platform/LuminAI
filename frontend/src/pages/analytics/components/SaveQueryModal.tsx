import React from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryName: string;
  setQueryName: (v: string) => void;
  canSave?: boolean;
  errorMessage?: string | null;
  onSave: () => void;
  isSaving: boolean;
}

export const SaveQueryModal: React.FC<SaveQueryModalProps> = ({
  isOpen,
  onClose,
  queryName,
  setQueryName,
  canSave = true,
  errorMessage,
  onSave,
  isSaving,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryName.trim() || !canSave || isSaving) return;
    onSave();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
      variant="form"
      title="Save SQL query"
      description="Store this query in your workspace library for reuse."
      preventClose={isSaving}
      statusMessage={isSaving ? "Saving SQL query..." : undefined}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSaving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="save-sql-query-form"
            variant="primary"
            size="sm"
            disabled={!queryName.trim() || !canSave || isSaving}
            isLoading={isSaving}
          >
            {isSaving ? "Saving..." : "Save query"}
          </Button>
        </>
      }
    >
      <form
        id="save-sql-query-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="save-query-name-input"
            className="text-xs font-medium text-text"
          >
            Query name
          </label>
          <input
            id="save-query-name-input"
            type="text"
            disabled={isSaving}
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            placeholder="Enter a descriptive query name"
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-border-focus disabled:opacity-50"
          />
        </div>
        {errorMessage && (
          <p
            role="alert"
            className="text-xs text-error bg-error-bg border border-error-border rounded-lg px-3 py-2.5"
          >
            {errorMessage}
          </p>
        )}
      </form>
    </Dialog>
  );
};
