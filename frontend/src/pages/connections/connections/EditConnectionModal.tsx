import React, { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import type { UnifiedSource } from "./connectionsTypes";

interface EditConnectionModalProps {
  source: UnifiedSource | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({
  source,
  isSaving,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(source?.name ?? "");

  useEffect(() => {
    setName(source?.name ?? "");
  }, [source]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  };

  return (
    <Modal
      open={!!source}
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
      title="Edit connection"
      description={source ? `Update settings for ${source.name}.` : undefined}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="edit-connection-name"
            className="block text-xs font-medium text-text-secondary"
          >
            Source name
          </label>
          <input
            id="edit-connection-name"
            type="text"
            required
            disabled={isSaving}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-border-focus disabled:opacity-50"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            disabled={!name.trim() || name.trim() === source?.name}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
