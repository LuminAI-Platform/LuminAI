import React from "react";
import { Button } from "../../../../components/ui/Button";

interface ConnectorDialogFooterProps {
  isConnected: boolean;
  isBusy: boolean;
  isTesting: boolean;
  isDiscovering: boolean;
  isSaving: boolean;
  formValid: boolean;
  host: string;
  selectedTablesCount: number;
  onCancel: () => void;
  onTestConnection: () => void;
  onEditCredentials: () => void;
  onRegister: () => void;
}

export const ConnectorDialogFooter: React.FC<ConnectorDialogFooterProps> = ({
  isConnected,
  isBusy,
  isTesting,
  isDiscovering,
  isSaving,
  formValid,
  host,
  selectedTablesCount,
  onCancel,
  onTestConnection,
  onEditCredentials,
  onRegister,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-border bg-surface shrink-0">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onCancel}
        disabled={isSaving}
      >
        Cancel
      </Button>

      <div className="flex flex-wrap items-center gap-2.5">
        {!isConnected ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onTestConnection}
              isLoading={isTesting}
              disabled={!formValid || isBusy}
            >
              {isTesting
                ? `Connecting to ${host.trim() || "host"}...`
                : "Test connection"}
            </Button>
            <Button
              type="submit"
              form="db-connector-credentials-form"
              variant="primary"
              size="sm"
              isLoading={isDiscovering}
              disabled={!formValid || isBusy}
            >
              {isDiscovering
                ? `Connecting to ${host.trim() || "host"}...`
                : "Connect & discover schemas"}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSaving}
              onClick={onEditCredentials}
            >
              Edit credentials
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onRegister}
              isLoading={isSaving}
              disabled={selectedTablesCount === 0 || isSaving}
            >
              {isSaving
                ? "Importing..."
                : `Import ${selectedTablesCount} table${selectedTablesCount === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
