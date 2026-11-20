import React, { useState, useRef, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Database, X, CheckCircle2, ICON_SIZES } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { BrandLoader } from "../../../components/ui/BrandLoader";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { TableSelector } from "./TableSelector";
import type { SchemaDiscovery } from "./TableSelector";
import { apiFetch } from "../../../lib/api";
import type { DBType } from "./db-connector/dbConnectorTypes";
import {
  DEFAULT_DB_PORTS,
  type DbFormField,
  type ClassifiedConnectionError,
  validateDbForm,
  isDbFormValid,
  classifyConnectionError,
} from "./db-connector/dbConnectorUtils";
import {
  ConnectorCredentials,
  type TestConnectionResult,
} from "./db-connector/ConnectorCredentials";

interface DatabaseConnectorFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDbType?: DBType;
}

const GUIDE_STEPS = [
  {
    step: 1,
    title: "Enter details",
    description:
      "Provide host, port, database name, and a read-only user account.",
  },
  {
    step: 2,
    title: "Test connection",
    description:
      "Verify network reachability and credentials before importing.",
  },
  {
    step: 3,
    title: "Choose tables",
    description: "Select which schemas and tables to register for sync.",
  },
];

export const DatabaseConnectorForm: React.FC<DatabaseConnectorFormProps> = ({
  onClose,
  onSuccess,
  initialDbType = "postgresql",
}) => {
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState<DBType>(initialDbType);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(
    String(DEFAULT_DB_PORTS[initialDbType] ?? 5432),
  );
  const [portManuallyEdited, setPortManuallyEdited] = useState(false);
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState<Partial<Record<DbFormField, boolean>>>(
    {},
  );
  const [isTesting, setIsTesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] =
    useState<ClassifiedConnectionError | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(
    null,
  );
  const [discoveredData, setDiscoveredData] = useState<SchemaDiscovery[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const formValues = useMemo(
    () => ({ name, dbType, host, port, databaseName, username, password }),
    [name, dbType, host, port, databaseName, username, password],
  );

  const errors = useMemo(() => validateDbForm(formValues), [formValues]);
  const formValid = useMemo(() => isDbFormValid(formValues), [formValues]);
  const isBusy = isTesting || isDiscovering;

  const hasUnsavedChanges = Boolean(
    name.trim() ||
    host.trim() ||
    databaseName.trim() ||
    username.trim() ||
    password.length > 0 ||
    isConnected,
  );

  const clearSecretsAndClose = () => {
    abortRef.current?.abort();
    setPassword("");
    onClose();
  };

  const requestClose = () => {
    if (isSaving) return;
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      clearSecretsAndClose();
    }
  };

  const handleDbTypeChange = (nextType: DBType) => {
    setDbType(nextType);
    if (!portManuallyEdited) {
      setPort(String(DEFAULT_DB_PORTS[nextType] ?? 5432));
    }
    setTestResult(null);
    setConnectionError(null);
  };

  const handlePortChange = (val: string) => {
    setPort(val);
    setPortManuallyEdited(true);
    setTestResult(null);
    setConnectionError(null);
  };

  const handleBlurField = (field: DbFormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const markAllTouched = () => {
    setTouched({
      name: true,
      host: true,
      port: true,
      databaseName: true,
      username: true,
      password: true,
    });
  };

  const handleApplyConnectionString = (parsed: {
    dbType?: DBType;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
  }) => {
    if (parsed.dbType) setDbType(parsed.dbType);
    if (parsed.host) setHost(parsed.host);
    if (parsed.port) {
      setPort(String(parsed.port));
      setPortManuallyEdited(true);
    }
    if (parsed.databaseName) setDatabaseName(parsed.databaseName);
    if (parsed.username) setUsername(parsed.username);
    if (parsed.password !== undefined) setPassword(parsed.password);
    setTestResult(null);
    setConnectionError(null);
  };

  const runDiscoverCall = async (): Promise<{
    schemas: SchemaDiscovery[];
    latencyMs: number;
  }> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const startedAt = performance.now();
    const res = await apiFetch("/api/v1/connections/discover", {
      method: "POST",
      signal: controller.signal,
      headers: { "X-Suppress-Toast": "true" },
      body: JSON.stringify({
        host: host.trim(),
        port: Number(port),
        database: databaseName.trim(),
        databaseName: databaseName.trim(),
        username: username.trim(),
        password,
      }),
    });

    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const rawMessage =
        typeof errBody?.message === "string" && errBody.message.trim()
          ? errBody.message
          : `Server rejected connection (HTTP ${res.status})`;
      throw new Error(rawMessage);
    }

    const data: SchemaDiscovery[] = await res.json();
    return { schemas: Array.isArray(data) ? data : [], latencyMs };
  };

  const handleTestConnection = async () => {
    markAllTouched();
    if (!formValid) return;

    setConnectionError(null);
    setTestResult(null);
    setIsTesting(true);

    try {
      const { schemas, latencyMs } = await runDiscoverCall();
      const tableCount = schemas.reduce((sum, s) => sum + s.tables.length, 0);
      setDiscoveredData(schemas);
      setTestResult({
        latencyMs,
        schemaCount: schemas.length,
        tableCount,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const rawMsg =
        err instanceof Error ? err.message : "Unexpected connection failure";
      setConnectionError(classifyConnectionError(rawMsg));
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectAndDiscover = async (e?: React.FormEvent) => {
    e?.preventDefault();
    markAllTouched();
    if (!formValid) return;

    // If a test just succeeded with the current credentials, advance immediately
    if (testResult && discoveredData) {
      setIsConnected(true);
      return;
    }

    setConnectionError(null);
    setIsDiscovering(true);

    try {
      const { schemas, latencyMs } = await runDiscoverCall();
      const tableCount = schemas.reduce((sum, s) => sum + s.tables.length, 0);
      setDiscoveredData(schemas);
      setTestResult({
        latencyMs,
        schemaCount: schemas.length,
        tableCount,
      });
      setIsConnected(true);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const rawMsg =
        err instanceof Error ? err.message : "Unexpected connection failure";
      setConnectionError(classifyConnectionError(rawMsg));
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleRegister = async () => {
    if (selectedTables.length === 0) return;
    setIsSaving(true);
    setConnectionError(null);
    try {
      const resolvedType =
        dbType === "sqlserver"
          ? "MSSQL"
          : dbType === "postgresql"
            ? "POSTGRESQL"
            : dbType === "mysql"
              ? "MYSQL"
              : "POSTGRESQL";

      const res = await apiFetch("/api/v1/connections", {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
        body: JSON.stringify({
          name: name.trim(),
          type: resolvedType,
          config: JSON.stringify({
            host: host.trim(),
            port: Number(port),
            database: databaseName.trim(),
            username: username.trim(),
            tables: selectedTables,
          }),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || "Failed to register database connector.",
        );
      }
      setPassword("");
      onSuccess();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Registration failed";
      setConnectionError(classifyConnectionError(rawMsg));
    } finally {
      setIsSaving(false);
    }
  };

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

            {/* Scrollable Body — stacks below 900px */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 items-start">
                {/* Left Column: Credentials or Connected Summary */}
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
                    <div className="bg-surface-subtle/50 border border-border rounded-lg p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success-bg border border-success-border flex items-center justify-center text-success shrink-0">
                          <CheckCircle2
                            className="w-4 h-4"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-success">
                            Database connected
                            {testResult ? ` (${testResult.latencyMs} ms)` : ""}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Select the tables to import from the right panel.
                          </p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs bg-surface p-3.5 rounded-lg border border-border">
                        <div>
                          <dt className="text-text-secondary text-[11px]">
                            Connector name
                          </dt>
                          <dd className="text-text font-medium truncate mt-0.5">
                            {name}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-secondary text-[11px]">
                            Database type
                          </dt>
                          <dd className="text-text font-medium uppercase mt-0.5">
                            {dbType}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-secondary text-[11px]">
                            Host
                          </dt>
                          <dd className="text-text font-mono text-[11px] truncate mt-0.5">
                            {host}:{port}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-text-secondary text-[11px]">
                            Database
                          </dt>
                          <dd className="text-text font-mono text-[11px] truncate mt-0.5">
                            {databaseName}
                          </dd>
                        </div>
                      </dl>

                      {connectionError && (
                        <div
                          role="alert"
                          className="p-3 rounded-lg bg-error-bg border border-error-border text-xs text-error"
                        >
                          <p className="font-semibold">
                            {connectionError.title}
                          </p>
                          <p className="text-text-secondary mt-0.5">
                            {connectionError.suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Three-Step Guide, Live Connecting State, or Table Picker */}
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
                    <div className="bg-surface-subtle/40 border border-border rounded-lg p-5 space-y-5">
                      <div>
                        <h3 className="text-xs font-semibold text-text">
                          How setup works
                        </h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Follow these three steps to connect and start syncing.
                        </p>
                      </div>

                      {isBusy && (
                        <div
                          role="status"
                          aria-live="polite"
                          className="p-3.5 rounded-lg bg-primary-tint border border-primary-border flex items-center gap-3"
                        >
                          <BrandLoader variant="inline" size={18} />
                          <span className="text-xs font-medium text-primary truncate">
                            Connecting to {host.trim() || "database"}...
                          </span>
                        </div>
                      )}

                      <ol className="space-y-3">
                        {GUIDE_STEPS.map((item) => {
                          const isCurrent = currentGuideStep === item.step;
                          const isDone = currentGuideStep > item.step;
                          return (
                            <li
                              key={item.step}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                isCurrent
                                  ? "bg-surface border-primary-border shadow-xs"
                                  : isDone
                                    ? "bg-success-bg/50 border-success-border"
                                    : "bg-surface/60 border-border"
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
                                  isCurrent
                                    ? "bg-primary text-primary-text"
                                    : isDone
                                      ? "bg-success text-primary-text"
                                      : "bg-surface-subtle border border-border text-text-secondary"
                                }`}
                              >
                                {item.step}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-text">
                                  {item.title}
                                </p>
                                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                                  {item.description}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-border bg-surface shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (isBusy) {
                    abortRef.current?.abort();
                    setIsTesting(false);
                    setIsDiscovering(false);
                  } else {
                    requestClose();
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
                      onClick={handleTestConnection}
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
                      onClick={() => {
                        setIsConnected(false);
                        setSelectedTables([]);
                      }}
                    >
                      Edit credentials
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleRegister}
                      isLoading={isSaving}
                      disabled={selectedTables.length === 0 || isSaving}
                    >
                      {isSaving
                        ? "Importing..."
                        : `Import ${selectedTables.length} table${selectedTables.length === 1 ? "" : "s"}`}
                    </Button>
                  </>
                )}
              </div>
            </div>
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
