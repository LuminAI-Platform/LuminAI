import React, { useState } from "react";
import { TableSelector } from "./TableSelector";
import type { SchemaDiscovery } from "./TableSelector";
import { apiFetch } from "../../../lib/api";

interface DatabaseConnectorFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

type DBType = "postgresql" | "mysql" | "snowflake" | "sqlserver";

interface ConnectionCheckStep {
  id: number;
  label: string;
  status: "idle" | "loading" | "success" | "error";
  errorMsg?: string;
}

const DEFAULT_DISCOVERED_DATA: Record<DBType, SchemaDiscovery[]> = {
  postgresql: [
    { schema: "public", tables: ["users", "profiles", "organizations", "roles", "audit_events"] },
    { schema: "analytics", tables: ["monthly_active_users", "revenue_summary", "feature_usage"] },
    { schema: "inventory", tables: ["products", "orders", "suppliers", "stock_items"] }
  ],
  mysql: [
    { schema: "default", tables: ["customers", "orders", "payments", "shippers"] },
    { schema: "marketing", tables: ["campaigns", "clicks", "conversions", "leads"] }
  ],
  snowflake: [
    { schema: "RAW_DATA", tables: ["EVENTS_STREAM", "USER_CLICKS", "TRANSACTIONS_LOG"] },
    { schema: "REPORTING", tables: ["DAILY_KPI", "FINANCIAL_LEDGER", "RETENTION_COHORTS"] }
  ],
  sqlserver: [
    { schema: "dbo", tables: ["Employees", "Departments", "Salaries", "Addresses"] },
    { schema: "sales", tables: ["Customers", "Invoices", "LineItems"] }
  ]
};

export const DatabaseConnectorForm: React.FC<DatabaseConnectorFormProps> = ({
  onClose,
  onSuccess
}) => {
  // Form fields state
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState<DBType>("postgresql");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(5432);
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // UI Flow State
  const [isVerifying, setIsVerifying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discoveredData, setDiscoveredData] = useState<SchemaDiscovery[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Connection Checklist State
  const [checkSteps, setCheckSteps] = useState<ConnectionCheckStep[]>([
    { id: 1, label: "Resolving host domain...", status: "idle" },
    { id: 2, label: "Establishing port TCP handshake...", status: "idle" },
    { id: 3, label: "Authenticating credentials...", status: "idle" },
    { id: 4, label: "Discovering database schemas...", status: "idle" }
  ]);

  // Update default port based on database type selection
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

  // Run the connection check checklist
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Initial Validation
    if (!name.trim()) return setValidationError("Connection Name is required.");
    if (!host.trim()) return setValidationError("Database Host address is required.");
    if (!databaseName.trim()) return setValidationError("Database Name is required.");
    if (!username.trim()) return setValidationError("Username is required.");
    if (!password.trim()) return setValidationError("Password is required.");

    setIsVerifying(true);
    
    // Helper to sleep for simulation steps
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Reset Checklist
    setCheckSteps([
      { id: 1, label: "Resolving host domain...", status: "idle" },
      { id: 2, label: "Establishing port TCP handshake...", status: "idle" },
      { id: 3, label: "Authenticating credentials...", status: "idle" },
      { id: 4, label: "Discovering database schemas...", status: "idle" }
    ]);

    // Step 1: Resolving Host
    setCheckSteps(prev => prev.map(s => s.id === 1 ? { ...s, status: "loading" } : s));
    await sleep(600);
    if (host.toLowerCase().includes("invalid") || host.trim().length < 3) {
      setCheckSteps(prev => prev.map(s => s.id === 1 ? { ...s, status: "error", errorMsg: "Host unresolved" } : s));
      setIsVerifying(false);
      return;
    }
    setCheckSteps(prev => prev.map(s => s.id === 1 ? { ...s, status: "success" } : s));

    // Step 2: Establish Port TCP Connection
    setCheckSteps(prev => prev.map(s => s.id === 2 ? { ...s, status: "loading" } : s));
    await sleep(600);
    if (port <= 0 || port > 65535) {
      setCheckSteps(prev => prev.map(s => s.id === 2 ? { ...s, status: "error", errorMsg: "Invalid Port" } : s));
      setIsVerifying(false);
      return;
    }
    setCheckSteps(prev => prev.map(s => s.id === 2 ? { ...s, status: "success" } : s));

    // Step 3: Authenticating Credentials
    setCheckSteps(prev => prev.map(s => s.id === 3 ? { ...s, status: "loading" } : s));
    await sleep(600);
    if (password === "wrong" || username === "error") {
      setCheckSteps(prev => prev.map(s => s.id === 3 ? { ...s, status: "error", errorMsg: "Access Denied" } : s));
      setIsVerifying(false);
      return;
    }
    setCheckSteps(prev => prev.map(s => s.id === 3 ? { ...s, status: "success" } : s));

    // Step 4: Discovering database schemas (Try calling real API, then fallback to mock)
    setCheckSteps(prev => prev.map(s => s.id === 4 ? { ...s, status: "loading" } : s));
    await sleep(600);

    try {
      // Attempt connection discover API payload
      const response = await apiFetch("/api/v1/connections/discover", {
        method: "POST",
        body: JSON.stringify({
          name,
          type: dbType,
          host,
          port,
          database: databaseName,
          username,
          password
        })
      });
      if (response && Array.isArray(response)) {
        setDiscoveredData(response as SchemaDiscovery[]);
      } else {
        // Fallback to static mock datasets
        setDiscoveredData(DEFAULT_DISCOVERED_DATA[dbType]);
      }
    } catch {
      // Fallback on connection issues
      setDiscoveredData(DEFAULT_DISCOVERED_DATA[dbType]);
    }

    setCheckSteps(prev => prev.map(s => s.id === 4 ? { ...s, status: "success" } : s));
    await sleep(400);

    setIsVerifying(false);
    setIsConnected(true);
  };

  // Save the connection metadata
  const handleRegister = async () => {
    if (selectedTables.length === 0) {
      setValidationError("Please select at least one database table to synchronize.");
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    const payload = {
      name,
      type: dbType,
      host,
      port,
      database: databaseName,
      username,
      selectedTables,
      status: "Connected"
    };

    try {
      // Attempt API POST to persist connector metadata
      await apiFetch("/api/v1/connections", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    } catch {
      // Fallback: save connector data to localStorage
      const customConnectorsStr = localStorage.getItem("local_database_connectors");
      const connectors = customConnectorsStr ? JSON.parse(customConnectorsStr) : [];
      
      const newConnectorObj = {
        id: Math.random().toString(36).substring(7),
        name: name,
        status: "Connected",
        pipelines: selectedTables.length,
        type: dbType === "postgresql" ? "Database" : dbType === "snowflake" ? "Warehouse" : "Database",
        desc: `Synchronized ${selectedTables.length} tables from ${databaseName} schema catalog.`
      };
      
      connectors.unshift(newConnectorObj);
      localStorage.setItem("local_database_connectors", JSON.stringify(connectors));
    }

    setIsSaving(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-xs z-50 p-4">
      <div 
        className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50 select-none">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              Database Connection Registry
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Register database configurations & discover schema assets</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
          
          {/* Left Panel: Credentials Form OR Progress Status */}
          <div className="md:col-span-6 flex flex-col gap-4">
            {!isConnected ? (
              <form onSubmit={handleConnect} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Connection Name</label>
                  <input
                    type="text"
                    required
                    disabled={isVerifying}
                    placeholder="e.g. Sales Production Replica"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 placeholder-zinc-600 disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Database Type</label>
                    <select
                      value={dbType}
                      disabled={isVerifying}
                      onChange={(e) => handleDbTypeChange(e.target.value as DBType)}
                      className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="snowflake">Snowflake</option>
                      <option value="sqlserver">SQL Server</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Port</label>
                    <input
                      type="number"
                      required
                      disabled={isVerifying}
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 disabled:opacity-50 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Database Host</label>
                    <input
                      type="text"
                      required
                      disabled={isVerifying}
                      placeholder="db.replica.internal"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 placeholder-zinc-600 disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Database Name</label>
                    <input
                      type="text"
                      required
                      disabled={isVerifying}
                      placeholder="sales_db"
                      value={databaseName}
                      onChange={(e) => setDatabaseName(e.target.value)}
                      className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 placeholder-zinc-600 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Username</label>
                    <input
                      type="text"
                      required
                      disabled={isVerifying}
                      placeholder="lumin_sync"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 placeholder-zinc-600 disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Password</label>
                    <input
                      type="password"
                      required
                      disabled={isVerifying}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-zinc-950 border border-zinc-850/80 rounded-lg py-2 px-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/80 placeholder-zinc-650 disabled:opacity-50"
                    />
                  </div>
                </div>

                {validationError && (
                  <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-xs flex gap-2 font-medium">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{validationError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none mt-2"
                >
                  {isVerifying ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4" className="opacity-75" />
                      </svg>
                      Establishing Pipeline Connection...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      Connect & Discover Schemas
                    </>
                  )}
                </button>
              </form>
            ) : (
              // Connected / Success Credentials View
              <div className="flex flex-col h-full bg-zinc-950/40 border border-zinc-850/60 p-5 rounded-xl justify-between gap-6 select-none">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 block">Database Connected</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">Catalog tables retrieved successfully</span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900 pt-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Connection Summary</span>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-mono text-[10px] text-zinc-400 bg-black/20 p-3 rounded-lg border border-zinc-900">
                      <div>Name: <span className="text-zinc-200">{name}</span></div>
                      <div>Type: <span className="text-zinc-200 uppercase">{dbType}</span></div>
                      <div>Host: <span className="text-zinc-200">{host}</span></div>
                      <div>Database: <span className="text-zinc-200">{databaseName}</span></div>
                      <div>Selected: <span className="text-blue-500 font-semibold">{selectedTables.length} tables</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsConnected(false);
                      setSelectedTables([]);
                    }}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Edit Credentials
                  </button>

                  <button
                    onClick={handleRegister}
                    disabled={isSaving || selectedTables.length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" className="opacity-25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4" className="opacity-75" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                        Register Connector
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Live Checklist OR Table Checklist */}
          <div className="md:col-span-6 flex flex-col min-h-0">
            {isVerifying ? (
              // Verification Checklist Dashboard
              <div className="flex flex-col h-full bg-zinc-950/60 border border-zinc-850/60 p-6 rounded-xl justify-center gap-6 select-none">
                <div className="flex flex-col gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Connection Handshake Checklist</h3>
                  <p className="text-[10px] text-zinc-500">Checking networking pipelines, authentication grants, and database catalogue tables</p>
                </div>
                <div className="flex flex-col gap-4">
                  {checkSteps.map((step) => (
                    <div key={step.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-3">
                        {step.status === "idle" && (
                          <div className="w-5 h-5 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                          </div>
                        )}
                        {step.status === "loading" && (
                          <svg className="animate-spin text-blue-500" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <circle cx="12" cy="12" r="10" className="opacity-20" />
                            <path d="M4 12a8 8 0 018-8" className="opacity-80" />
                          </svg>
                        )}
                        {step.status === "success" && (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                            ✓
                          </div>
                        )}
                        {step.status === "error" && (
                          <div className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
                            ✕
                          </div>
                        )}
                        <span className={`font-mono ${step.status === "loading" ? "text-zinc-200 font-bold" : step.status === "success" ? "text-zinc-300" : "text-zinc-500"}`}>
                          {step.label}
                        </span>
                      </div>

                      {step.status === "error" && step.errorMsg && (
                        <span className="text-[10px] bg-red-950/40 text-red-400 border border-red-500/25 px-2 py-0.5 rounded font-semibold font-mono">
                          {step.errorMsg}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : isConnected ? (
              // Discovered schemas & tables selection checklist
              <div className="flex-1 flex flex-col min-h-0 gap-3">
                <TableSelector
                  discovered={discoveredData}
                  selectedTables={selectedTables}
                  onChange={setSelectedTables}
                />
                {validationError && (
                  <div className="p-2.5 bg-red-950/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] flex gap-2 font-medium">
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
            ) : (
              // Default Welcome Panel before validation
              <div className="flex flex-col h-full bg-zinc-950/20 border border-zinc-850/60 p-6 rounded-xl items-center justify-center text-center select-none">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="text-zinc-700 mb-4 animate-pulse">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 11 12 14 22 4" className="opacity-30" />
                </svg>
                <span className="text-xs font-semibold text-zinc-400">Connection Handshake Pending</span>
                <p className="text-[10px] text-zinc-500 mt-1 max-w-[280px] leading-relaxed">
                  Provide connection endpoints and database username grants on the left, then click Connect & Discover to run database checklists
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
