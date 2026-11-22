import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Database, X, ICON_SIZES } from "../../../lib/icons";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { TableSelector } from "./TableSelector";
import type { DBType } from "./db-connector/dbConnectorTypes";
import { ConnectorCredentials } from "./db-connector/ConnectorCredentials";
import { useDbConnectorForm } from "./db-connector/useDbConnectorForm";
import { DbSetupGuidePanel } from "./db-connector/DbSetupGuidePanel";
import { ConnectedSummaryCard } from "./db-connector/ConnectedSummaryCard";
import { DbConnectorModalFooter } from "./db-connector/DbConnectorModalFooter";

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
  const {
    name,
    setName,
    dbType,
    host,
    setHost,
    port,
    databaseName,
    setDatabaseName,
    username,
    setUsername,
    password,
    setPassword,
    touched,
    isTesting,
    isDiscovering,
    isConnected,
    setIsConnected,
    connectionError,
    setConnectionError,
    testResult,
    setTestResult,
    discoveredData,
    selectedTables,
    setSelectedTables,
    isSaving,
    showDiscardConfirm,
    setShowDiscardConfirm,
    errors,
    formValid,
    isBusy,
    hasUnsavedChanges,
    abortRef,
    clearSecretsAndClose,
    requestClose,
    handleDbTypeChange,
    handlePortChange,
    handleBlurField,
    handleApplyConnectionString,
    handleTestConnection,
    handleConnectAndDiscover,
    handleRegister,
  } = useDbConnectorForm({
    initialDbType,
    onSuccess,
    onClose,
  });

  const currentGuideStep = isConnected ? 3 : isBusy || testResult ? 2 : 1;

  return (
    <>
      <Dialog.Root
        open={true}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[99990] bg-black/70 backdrop-blur-xs" />
          <Dialog.Content
            aria-modal="true"
            onEscapeKeyDown={(e) => {
              if (hasUnsavedChanges) {
                e.preventDefault();
                setShowDiscardConfirm(true);
              }
            }}
            onPointerDownOutside={(e) => {
              if (hasUnsavedChanges) {
                e.preventDefault();
                setShowDiscardConfirm(true);
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
                onClick={requestClose}
                aria-label="Close dialog"
                className="p-1.5 text-text-secondary hover:text-text hover:bg-surface-hover rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X size={ICON_SIZES.dropdown} aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 items-start">
                <div className="min-[900px]:col-span-6 flex flex-col gap-4">
                  {!isConnected ? (
                    <ConnectorCredentials
                      name={name}
                      setName={(v) => {
                        setName(v);
                        setTestResult(null);
                      }}
                      dbType={dbType}
                      host={host}
                      setHost={(v) => {
                        setHost(v);
                        setTestResult(null);
                        setConnectionError(null);
                      }}
                      port={port}
                      onPortChange={handlePortChange}
                      databaseName={databaseName}
                      setDatabaseName={(v) => {
                        setDatabaseName(v);
                        setTestResult(null);
                        setConnectionError(null);
                      }}
                      username={username}
                      setUsername={(v) => {
                        setUsername(v);
                        setTestResult(null);
                        setConnectionError(null);
                      }}
                      password={password}
                      setPassword={(v) => {
                        setPassword(v);
                        setTestResult(null);
                        setConnectionError(null);
                      }}
                      errors={errors}
                      touched={touched}
                      onBlurField={handleBlurField}
                      isVerifying={isBusy}
                      connectionError={connectionError}
                      testResult={testResult}
                      onSubmitForm={handleConnectAndDiscover}
                      handleDbTypeChange={handleDbTypeChange}
                      onApplyConnectionString={handleApplyConnectionString}
                    />
                  ) : (
                    <ConnectedSummaryCard
                      name={name}
                      dbType={dbType}
                      host={host}
                      port={port}
                      databaseName={databaseName}
                      testResult={testResult}
                      connectionError={connectionError}
                    />
                  )}
                </div>

                <div className="min-[900px]:col-span-6 flex flex-col min-h-0">
                  {isConnected ? (
                    <div className="min-h-[340px] max-h-[460px] flex flex-col">
                      <TableSelector
                        discovered={discoveredData}
                        selectedTables={selectedTables}
                        onChange={setSelectedTables}
                      />
                    </div>
                  ) : (
                    <DbSetupGuidePanel
                      isBusy={isBusy}
                      host={host}
                      currentGuideStep={currentGuideStep}
                    />
                  )}
                </div>
              </div>
            </div>

            <DbConnectorModalFooter
              isConnected={isConnected}
              isBusy={isBusy}
              isSaving={isSaving}
              isTesting={isTesting}
              isDiscovering={isDiscovering}
              formValid={formValid}
              host={host}
              selectedTablesCount={selectedTables.length}
              abortCurrentRequest={() => abortRef.current?.abort()}
              onRequestClose={requestClose}
              onTestConnection={handleTestConnection}
              onEditCredentials={() => {
                setIsConnected(false);
                setSelectedTables([]);
              }}
              onRegister={handleRegister}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        title="Discard unsaved changes?"
        description="Your entered database details will be cleared."
        confirmText="Discard"
        cancelText="Keep editing"
        isDestructive={true}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          clearSecretsAndClose();
        }}
      />
    </>
  );
};
