import { apiFetch } from "../../../../lib/api";
import type { SchemaDiscovery } from "../TableSelector";
import type { DBType } from "./dbConnectorTypes";

interface DiscoverParams {
  host: string;
  port: string;
  databaseName: string;
  username: string;
  password: string;
  signal: AbortSignal;
}

export async function discoverDatabaseSchemas(
  params: DiscoverParams,
): Promise<{ schemas: SchemaDiscovery[]; latencyMs: number }> {
  const startedAt = performance.now();
  const res = await apiFetch("/api/v1/connections/discover", {
    method: "POST",
    signal: params.signal,
    headers: { "X-Suppress-Toast": "true" },
    body: JSON.stringify({
      host: params.host.trim(),
      port: Number(params.port),
      database: params.databaseName.trim(),
      databaseName: params.databaseName.trim(),
      username: params.username.trim(),
      password: params.password,
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
}

interface RegisterParams {
  name: string;
  dbType: DBType;
  host: string;
  port: string;
  databaseName: string;
  username: string;
  selectedTables: string[];
}

export async function registerDatabaseConnection(
  params: RegisterParams,
): Promise<void> {
  const resolvedType =
    params.dbType === "sqlserver"
      ? "MSSQL"
      : params.dbType === "postgresql"
        ? "POSTGRESQL"
        : params.dbType === "mysql"
          ? "MYSQL"
          : "POSTGRESQL";

  const res = await apiFetch("/api/v1/connections", {
    method: "POST",
    headers: { "X-Suppress-Toast": "true" },
    body: JSON.stringify({
      name: params.name.trim(),
      type: resolvedType,
      config: JSON.stringify({
        host: params.host.trim(),
        port: Number(params.port),
        database: params.databaseName.trim(),
        username: params.username.trim(),
        tables: params.selectedTables,
      }),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to register database connector.");
  }
}
