import React from "react";
import { Button } from "../../../../components/ui/Button";

interface DbConnectorModalFooterProps {
  isConnected: boolean;
  isBusy: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isDiscovering: boolean;
  formValid: boolean;
  host: string;
  selectedTablesCount: number;
  abortCurrentRequest: () => void;
  onRequestClose: () => void;
  onTestConnection: () => void;
  onEditCredentials: () => void;
  onRegister: () => void;
}

export const DbConnectorModalFooter: React.FC<DbConnectorModalFooterProps> = ({
  isConnected,
  isBusy,
  isSaving,
  isTesting,
  isDiscovering,
  formValid,
  host,
  selectedTablesCount,
  abortCurrentRequest,
  onRequestClose,
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
        onClick={() => {
          if (isBusy) {
            abortCurrentRequest();
          } else {
            onRequestClose();
          }
        }}
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
