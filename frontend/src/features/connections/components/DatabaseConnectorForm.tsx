import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Database, X, ICON_SIZES } from "../../../lib/icons";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { TableSelector } from "./TableSelector";
import type { DBType } from "./db-connector/dbConnectorTypes";
import { ConnectorCredentials } from "./db-connector/ConnectorCredentials";
import { ConnectedDetailsCard } from "./db-connector/ConnectedDetailsCard";
import { ConnectorGuidePanel } from "./db-connector/ConnectorGuidePanel";
import { ConnectorDialogFooter } from "./db-connector/ConnectorDialogFooter";
import { useDatabaseConnectorForm } from "./db-connector/useDatabaseConnectorForm";

interface DatabaseConnectorFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDbType?: DBType;
}

export const DatabaseConnectorForm: React.FC<DatabaseConnectorFormProps> = ({
  onClose,
  onSuccess,
  initialDbType = "postgresql",
}) => {
  const form = useDatabaseConnectorForm({ initialDbType, onClose, onSuccess });

  return (
    <>
      <Dialog.Root
        open={true}
        onOpenChange={(open) => {
          if (!open) form.requestClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[99990] bg-black/70 backdrop-blur-xs" />
          <Dialog.Content
            aria-modal="true"
            onEscapeKeyDown={(e) => {
              if (form.hasUnsavedChanges) {
                e.preventDefault();
                form.setShowDiscardConfirm(true);
              }
            }}
            onPointerDownOutside={(e) => {
              if (form.hasUnsavedChanges) {
                e.preventDefault();
                form.setShowDiscardConfirm(true);
              }
            }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99991] w-[min(960px,calc(100vw-48px))] max-h-[calc(100vh-48px)] bg-surface border border-border rounded-lg shadow-lg flex flex-col overflow-hidden focus:outline-none"
          >
            {/* Fixed Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0 select-none">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
                  <Database className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-sm font-semibold text-text truncate">
                    Configure database source
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-text-secondary mt-0.5 truncate">
                    Connect a database and choose which tables to sync.
                  </Dialog.Description>
                </div>
              </div>
              <button
                type="button"
                onClick={form.requestClose}
                aria-label="Close dialog"
                className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X size={ICON_SIZES.dropdown} aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Body — stacks below 900px */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 items-start">
                {/* Left Column: Credentials or Connected Summary */}
                <div className="min-[900px]:col-span-6 flex flex-col gap-4">
                  {!form.isConnected ? (
                    <ConnectorCredentials
                      name={form.name}
                      setName={form.setName}
                      dbType={form.dbType}
                      host={form.host}
                      setHost={form.setHost}
                      port={form.port}
                      onPortChange={form.handlePortChange}
                      databaseName={form.databaseName}
                      setDatabaseName={form.setDatabaseName}
                      username={form.username}
                      setUsername={form.setUsername}
                      password={form.password}
                      setPassword={form.setPassword}
                      errors={form.errors}
                      touched={form.touched}
                      onBlurField={form.handleBlurField}
                      isVerifying={form.isBusy}
                      connectionError={form.connectionError}
                      testResult={form.testResult}
                      onSubmitForm={form.handleConnectAndDiscover}
                      handleDbTypeChange={form.handleDbTypeChange}
                      onApplyConnectionString={form.handleApplyConnectionString}
                    />
                  ) : (
                    <ConnectedDetailsCard
                      name={form.name}
                      dbType={form.dbType}
                      host={form.host}
                      port={form.port}
                      databaseName={form.databaseName}
                      testResult={form.testResult}
                      connectionError={form.connectionError}
                    />
                  )}
                </div>

                {/* Right Column: Three-Step Guide or Table Picker */}
                <div className="min-[900px]:col-span-6 flex flex-col min-h-0">
                  {form.isConnected ? (
                    <div className="min-h-[340px] max-h-[460px] flex flex-col">
                      <TableSelector
                        discovered={form.discoveredData}
                        selectedTables={form.selectedTables}
                        onChange={form.setSelectedTables}
                      />
                    </div>
                  ) : (
                    <ConnectorGuidePanel
                      currentGuideStep={form.currentGuideStep}
                      isBusy={form.isBusy}
                      host={form.host}
                    />
                  )}
                </div>
              </div>
            </div>

            <ConnectorDialogFooter
              isConnected={form.isConnected}
              isBusy={form.isBusy}
              isTesting={form.isTesting}
              isDiscovering={form.isDiscovering}
              isSaving={form.isSaving}
              formValid={form.formValid}
              host={form.host}
              selectedTablesCount={form.selectedTables.length}
              onCancel={form.handleCancelClick}
              onTestConnection={form.handleTestConnection}
              onEditCredentials={() => {
                form.setIsConnected(false);
                form.setSelectedTables([]);
              }}
              onRegister={form.handleRegister}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={form.showDiscardConfirm}
        onOpenChange={form.setShowDiscardConfirm}
        title="Discard unsaved changes?"
        description="Your entered database details will be cleared."
        confirmText="Discard"
        cancelText="Keep editing"
        isDestructive={true}
        onConfirm={() => {
          form.setShowDiscardConfirm(false);
          form.clearSecretsAndClose();
        }}
      />
    </>
  );
};
