import { useState, useRef } from "react";
import type { DBType } from "./dbConnectorTypes";
import type { SchemaDiscovery } from "../TableSelector";
import { apiFetch } from "../../../../lib/api";
import {
  type ClassifiedConnectionError,
  classifyConnectionError,
} from "./dbConnectorUtils";
import type { TestConnectionResult } from "./ConnectorCredentials";

interface DiscoveryParams {
  name: string;
  dbType: DBType;
  host: string;
  port: string;
  databaseName: string;
  username: string;
  password: string;
  formValid: boolean;
  markAllTouched: () => void;
  onSuccess: () => void;
  clearPassword: () => void;
}

export function useDbConnectorDiscovery({
  name,
  dbType,
  host,
  port,
  databaseName,
  username,
  password,
  formValid,
  markAllTouched,
  onSuccess,
  clearPassword,
}: DiscoveryParams) {
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

  const abortRef = useRef<AbortController | null>(null);

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
              : "SNOWFLAKE";

      const res = await apiFetch("/api/v1/connections", {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
        body: JSON.stringify({
          name: name.trim(),
          type: resolvedType,
          host: host.trim(),
          port: Number(port),
          database: databaseName.trim(),
          username: username.trim(),
          password,
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
      const created = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      if (created?.id) {
        await apiFetch(`/api/v1/connections/${created.id}/sync`, {
          method: "POST",
          headers: { "X-Suppress-Toast": "true" },
          body: JSON.stringify({ tables: selectedTables }),
        }).catch(() => null);
      }
      clearPassword();
      onSuccess();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Registration failed";
      setConnectionError(classifyConnectionError(rawMsg));
    } finally {
      setIsSaving(false);
    }
  };

  return {
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
    abortRef,
    handleTestConnection,
    handleConnectAndDiscover,
    handleRegister,
  };
}
