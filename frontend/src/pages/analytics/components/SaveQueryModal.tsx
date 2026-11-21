import React from "react";
import { BodyPortal } from "../../../components/ui/BodyPortal";
import { Button } from "../../../components/ui/Button";

interface SaveQueryModalProps {
  queryName: string;
  onQueryNameChange: (name: string) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export const SaveQueryModal: React.FC<SaveQueryModalProps> = ({
  queryName,
  onQueryNameChange,
  isSaving,
  onCancel,
  onSave,
}) => {
  return (
    <BodyPortal>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9990] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-sql-query-title"
      >
        <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
          <h3
            id="save-sql-query-title"
            className="text-base font-bold text-text"
          >
            Save SQL Query
          </h3>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sql-query-name-input"
              className="text-xs font-medium text-text-secondary"
            >
              Query Name
            </label>
            <input
              id="sql-query-name-input"
              type="text"
              value={queryName}
              onChange={(e) => onQueryNameChange(e.target.value)}
              placeholder="e.g. Monthly Revenue by Tier"
              className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
            />
          </div>
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!queryName.trim()}
              isLoading={isSaving}
              onClick={onSave}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
};
