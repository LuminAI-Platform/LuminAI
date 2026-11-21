import { useState, useRef, useEffect, useCallback } from "react";
import type { SchemaDiscovery } from "../TableSelector";
import type { DBType } from "./dbConnectorTypes";
import {
  type ClassifiedConnectionError,
  classifyConnectionError,
} from "./dbConnectorUtils";
import type { TestConnectionResult } from "./ConnectorCredentials";
import {
  discoverDatabaseSchemas,
  registerDatabaseConnection,
} from "./dbConnectorApi";
import { useDbCredentialFields } from "./useDbCredentialFields";

interface UseDatabaseConnectorFormParams {
  initialDbType: DBType;
  onClose: () => void;
  onSuccess: () => void;
}

export function useDatabaseConnectorForm({
  initialDbType,
  onClose,
  onSuccess,
}: UseDatabaseConnectorFormParams) {
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const resetTestOnly = useCallback(() => setTestResult(null), []);
  const resetStatus = useCallback(() => {
    setTestResult(null);
    setConnectionError(null);
  }, []);

  const fields = useDbCredentialFields(
    initialDbType,
    resetStatus,
    resetTestOnly,
  );

  const isBusy = isTesting || isDiscovering;
  const hasUnsavedChanges = fields.hasFieldInput || isConnected;

  const clearSecretsAndClose = () => {
    abortRef.current?.abort();
    fields.clearPassword();
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

  const handleCancelClick = () => {
    if (isBusy) {
      abortRef.current?.abort();
      setIsTesting(false);
      setIsDiscovering(false);
    } else {
      requestClose();
    }
  };

  const executeDiscovery = async (advanceOnSuccess: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { schemas, latencyMs } = await discoverDatabaseSchemas({
      host: fields.host,
      port: fields.port,
      databaseName: fields.databaseName,
      username: fields.username,
      password: fields.password,
      signal: controller.signal,
    });
    const tableCount = schemas.reduce((sum, s) => sum + s.tables.length, 0);
    setDiscoveredData(schemas);
    setTestResult({ latencyMs, schemaCount: schemas.length, tableCount });
    if (advanceOnSuccess) setIsConnected(true);
  };

  const handleTestConnection = async () => {
    fields.markAllTouched();
    if (!fields.formValid) return;

    setConnectionError(null);
    setTestResult(null);
    setIsTesting(true);
    try {
      await executeDiscovery(false);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const rawMsg =
        err instanceof Error ? err.message : "Unexpected connection failure";
      setConnectionError(classifyConnectionError(rawMsg));
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnectAndDiscover = async (e?: React.FormEvent) => {
    e?.preventDefault();
    fields.markAllTouched();
    if (!fields.formValid) return;

    if (testResult && discoveredData) {
      setIsConnected(true);
      return;
    }

    setConnectionError(null);
    setIsDiscovering(true);
    try {
      await executeDiscovery(true);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
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
      await registerDatabaseConnection({
        name: fields.name,
        dbType: fields.dbType,
        host: fields.host,
        port: fields.port,
        databaseName: fields.databaseName,
        username: fields.username,
        selectedTables,
      });
      fields.clearPassword();
      onSuccess();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Registration failed";
      setConnectionError(classifyConnectionError(rawMsg));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    ...fields,
    isBusy,
    isTesting,
    isDiscovering,
    isConnected,
    setIsConnected,
    connectionError,
    testResult,
    discoveredData,
    selectedTables,
    setSelectedTables,
    isSaving,
    hasUnsavedChanges,
    showDiscardConfirm,
    setShowDiscardConfirm,
    currentGuideStep: isConnected ? 3 : isBusy || testResult ? 2 : 1,
    clearSecretsAndClose,
    requestClose,
    handleCancelClick,
    handleTestConnection,
    handleConnectAndDiscover,
    handleRegister,
  };
}
