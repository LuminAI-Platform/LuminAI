import React, { useState, useEffect } from "react";
import { TableSelector } from "./TableSelector";
import type { SchemaDiscovery } from "./TableSelector";
import { apiFetch } from "../../../lib/api";
import type {
  DBType,
  ConnectionCheckStep,
} from "./db-connector/dbConnectorTypes";
import { INITIAL_CHECK_STEPS } from "./db-connector/dbConnectorTypes";
import { VerificationChecklist } from "./db-connector/VerificationChecklist";
import { ConnectorCredentials } from "./db-connector/ConnectorCredentials";
import { ConnectedSummary } from "./db-connector/ConnectedSummary";

interface DatabaseConnectorFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const DatabaseConnectorForm: React.FC<DatabaseConnectorFormProps> = ({
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState<DBType>("postgresql");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(5432);
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isVerifying, setIsVerifying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discoveredData, setDiscoveredData] = useState<SchemaDiscovery[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [checkSteps, setCheckSteps] =
    useState<ConnectionCheckStep[]>(INITIAL_CHECK_STEPS);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDbTypeChange = (type: DBType) => {
    setDbType(type);
    switch (type) {
      case "postgresql":
        setPort(5432);
        break;
      case "mysql":
        setPort(3306);
        break;
      case "snowflake":
        setPort(443);
        break;
      case "sqlserver":
        setPort(1433);
        break;
    }
  };

  const updateStep = (
    id: number,
    status: ConnectionCheckStep["status"],
    errorMsg?: string,
  ) => {
    setCheckSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, errorMsg } : s)),
    );
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setIsVerifying(true);
    setCheckSteps(INITIAL_CHECK_STEPS);

    try {
      updateStep(1, "loading");
      const res = await apiFetch("/api/v1/connectors/test", {
        method: "POST",
        body: JSON.stringify({
          name,
          dbType,
          host,
          port,
          databaseName,
          username,
          password,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || "Failed to establish database connection.",
        );
      }

      const testResult = await res.json();
      updateStep(1, "success");
      updateStep(2, "success");
      updateStep(3, "success");
      updateStep(4, "loading");

      const discRes = await apiFetch("/api/v1/connectors/discover", {
        method: "POST",
        body: JSON.stringify({
          dbType,
          host,
          port,
          databaseName,
          username,
          password,
        }),
      });

      if (!discRes.ok) {
        throw new Error("Connected, but failed to discover database schemas.");
      }

      const discData: SchemaDiscovery[] = await discRes.json();
      updateStep(4, "success");

      setTimeout(() => {
        setIsVerifying(false);
        setIsConnected(true);
        setDiscoveredData(
          discData.length > 0 ? discData : testResult.discoveredSchemas || [],
        );
      }, 500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unexpected connection failure";
      setValidationError(msg);
      updateStep(1, "error", msg);
      setIsVerifying(false);
    }
  };

  const handleRegister = async () => {
    if (selectedTables.length === 0) return;
    setIsSaving(true);
    try {
      const res = await apiFetch("/api/v1/connectors", {
        method: "POST",
        body: JSON.stringify({
          name,
          type: dbType,
          config: {
            host,
            port,
            database: databaseName,
            username,
            tables: selectedTables,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to register database connector.");
      onSuccess();
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : "Registration failed",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
                <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Configure Database Source
              </h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Stream enterprise database tables directly into LuminAI Graph
                Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content body */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-y-auto p-6 gap-6">
          <div className="md:col-span-6 flex flex-col justify-between">
            {!isConnected ? (
              <ConnectorCredentials
                name={name}
                setName={setName}
                dbType={dbType}
                setDbType={setDbType}
                host={host}
                setHost={setHost}
                port={port}
                setPort={setPort}
                databaseName={databaseName}
                setDatabaseName={setDatabaseName}
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                isVerifying={isVerifying}
                validationError={validationError}
                onVerify={handleVerify}
                handleDbTypeChange={handleDbTypeChange}
              />
            ) : (
              <ConnectedSummary
                name={name}
                dbType={dbType}
                host={host}
                databaseName={databaseName}
                selectedTables={selectedTables}
                isSaving={isSaving}
                onEdit={() => {
                  setIsConnected(false);
                  setSelectedTables([]);
                }}
                onRegister={handleRegister}
              />
            )}
          </div>

          <div className="md:col-span-6 flex flex-col min-h-0">
            {isVerifying ? (
              <VerificationChecklist checkSteps={checkSteps} />
            ) : isConnected ? (
              <div className="flex flex-col h-full bg-zinc-950/60 border border-zinc-850/60 rounded-lg p-4 min-h-[350px]">
                <TableSelector
                  discovered={discoveredData}
                  selectedTables={selectedTables}
                  onChange={setSelectedTables}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-zinc-950/20 border border-dashed border-zinc-850 rounded-lg">
                <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <h4 className="text-xs font-semibold text-zinc-300">
                  Catalog Preview Pending
                </h4>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                  Fill in your target database credentials and click connect to
                  initiate live schema introspection.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
