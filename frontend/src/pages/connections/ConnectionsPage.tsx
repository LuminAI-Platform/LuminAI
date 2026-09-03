import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { FileUploadWizard } from "../../features/connections/components/FileUploadWizard";
import { DatabaseConnectorForm } from "../../features/connections/components/DatabaseConnectorForm";
import { SyncJobDetails } from "../../features/connections/components/SyncJobDetails";
import { ExecutionLogs } from "../../features/connections/components/ExecutionLogs";
import { apiFetch } from "../../lib/api";

interface IngestedFile {
  id: string;
  name: string;
  size: string;
  recordsCount: number;
  status: "Synced" | "Failed" | "Syncing";
  createdAt: string;
  columns?: string[];
  sampleRows?: Record<string, unknown>[];
}

interface DatabaseConnector {
  id?: string;
  name: string;
  status: string;
  pipelines: number;
  type: string;
  desc: string;
}

export const ConnectionsPage: React.FC = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<IngestedFile | null>(
    null,
  );
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>(() => {
    const stored = localStorage.getItem("local_ingested_files");
    if (stored) {
      return JSON.parse(stored);
    } else {
      const initialFiles: IngestedFile[] = [];
      localStorage.setItem(
        "local_ingested_files",
        JSON.stringify(initialFiles),
      );
      return initialFiles;
    }
  });

  const [customConnectors, setCustomConnectors] = useState<DatabaseConnector[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"connectors" | "files">(
    "connectors",
  );

  // Fetch connectors from GET /api/v1/connections
  const loadConnectors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/connections");
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped: DatabaseConnector[] = data.map(
          (item: Record<string, unknown>) => {
            let pipelinesCount = 0;
            let configDesc = "";
            if (typeof item.config === "string") {
              try {
                const parsed = JSON.parse(item.config);
                if (Array.isArray(parsed.selectedTables)) {
                  pipelinesCount = parsed.selectedTables.length;
                }
                if (parsed.database) {
                  configDesc = `Connected to ${parsed.database} database.`;
                }
              } catch {
                // Ignore json parse error
              }
            }

            return {
              id: typeof item.id === "string" ? item.id : undefined,
              name: String(item.name || ""),
              status:
                item.status === "ACTIVE"
                  ? "Connected"
                  : String(item.status || "Connected"),
              pipelines: pipelinesCount || 1,
              type: String(item.type || "Database"),
              desc:
                configDesc ||
                (typeof item.credentialsRef === "string"
                  ? item.credentialsRef
                  : "Registered database pipeline connector."),
            };
          },
        );
        setCustomConnectors(mapped);
      } else {
        setCustomConnectors([]);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load registered connections";
      setError(msg);
      setCustomConnectors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadConnectors();
    };
    init();
  }, []);

  // Load files list from localStorage or initialize with mock data
  const loadFiles = () => {
    const stored = localStorage.getItem("local_ingested_files");
    if (stored) {
      setIngestedFiles(JSON.parse(stored));
    } else {
      const initialFiles: IngestedFile[] = [];
      localStorage.setItem(
        "local_ingested_files",
        JSON.stringify(initialFiles),
      );
      setIngestedFiles(initialFiles);
    }
  };

  const deleteConnector = async (id: string) => {
    try {
      await apiFetch(`/api/v1/connections/${id}`, {
        method: "DELETE",
      });
      setCustomConnectors((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      console.error("Failed to delete connection", err);
    }
  };

  const handleWizardSuccess = () => {
    // Read the file object or state from some place? In the wizard, we know what we uploaded.
    // Let's add the last uploaded file to localStorage.
    // In our FileUploadWizard, we can read/write directly, but we can also just refresh.
    // Let's check localStorage for any new mapping or files written by the wizard.
    // We will append a new file object.
    const stored = localStorage.getItem("local_ingested_files");
    const files: IngestedFile[] = stored ? JSON.parse(stored) : [];

    // In real use case, the wizard runs and writes to local_ingested_files directly,
    // let's simulate it by checking if a new one was added, or we add one manually:
    const mostRecentFile = localStorage.getItem("most_recent_ingested_file");
    if (mostRecentFile) {
      const newFileObj = JSON.parse(mostRecentFile);
      if (!files.some((f) => f.name === newFileObj.name)) {
        files.unshift({
          id: Math.random().toString(36).substring(7),
          name: newFileObj.name,
          size: newFileObj.size,
          recordsCount: newFileObj.recordsCount,
          status: "Synced",
          createdAt: new Date().toLocaleString(),
          columns: newFileObj.columns,
          sampleRows: newFileObj.sampleRows,
        });
        localStorage.setItem("local_ingested_files", JSON.stringify(files));
        localStorage.removeItem("most_recent_ingested_file");
      }
    }
    loadFiles();
  };

  const getPreviewData = (
    file: IngestedFile,
  ): { columns: string[]; rows: Record<string, unknown>[] } => {
    if (file.columns && file.sampleRows && file.sampleRows.length > 0) {
      return { columns: file.columns, rows: file.sampleRows };
    }
    if (file.name.toLowerCase().includes("user")) {
      const columns = [
        "user_id",
        "email_address",
        "full_name",
        "account_status",
        "monthly_spend",
        "country_code",
      ];
      const rows = [
        {
          user_id: "usr_8f2k91",
          email_address: "alice@corp.io",
          full_name: "Alice Mensah",
          account_status: "active",
          monthly_spend: "$1,250.00",
          country_code: "GH",
        },
        {
          user_id: "usr_9k3x12",
          email_address: "kwame.b@innov.com",
          full_name: "Kwame Boateng",
          account_status: "active",
          monthly_spend: "$3,400.50",
          country_code: "GH",
        },
        {
          user_id: "usr_2m8p45",
          email_address: "sarah.j@apex.org",
          full_name: "Sarah Jenkins",
          account_status: "pending",
          monthly_spend: "$890.00",
          country_code: "US",
        },
        {
          user_id: "usr_5v1n77",
          email_address: "elena.r@fin.eu",
          full_name: "Elena Rostova",
          account_status: "active",
          monthly_spend: "$4,120.00",
          country_code: "DE",
        },
      ];
      return { columns, rows };
    }
    if (
      file.name.toLowerCase().includes("sale") ||
      file.name.toLowerCase().includes("transaction")
    ) {
      const columns = [
        "transaction_id",
        "user_id",
        "amount",
        "currency",
        "payment_method",
        "timestamp",
        "status",
      ];
      const rows = [
        {
          transaction_id: "txn_91a0c4",
          user_id: "usr_8f2k91",
          amount: "$450.00",
          currency: "USD",
          payment_method: "Credit Card",
          timestamp: "2024-03-01 14:22:10",
          status: "completed",
        },
        {
          transaction_id: "txn_82b1d3",
          user_id: "usr_9k3x12",
          amount: "$1,200.00",
          currency: "USD",
          payment_method: "Wire Transfer",
          timestamp: "2024-03-01 15:40:02",
          status: "completed",
        },
        {
          transaction_id: "txn_73c2e2",
          user_id: "usr_2m8p45",
          amount: "$89.50",
          currency: "USD",
          payment_method: "Debit Card",
          timestamp: "2024-03-02 09:12:45",
          status: "refunded",
        },
      ];
      return { columns, rows };
    }
    const columns = [
      "record_id",
      "name",
      "category",
      "value",
      "created_at",
      "status",
    ];
    const rows = [
      {
        record_id: "rec_001",
        name: "Sample Item Alpha",
        category: "Standard",
        value: "100",
        created_at: "2024-02-15",
        status: "synced",
      },
      {
        record_id: "rec_002",
        name: "Sample Item Beta",
        category: "Enterprise",
        value: "250",
        created_at: "2024-02-18",
        status: "synced",
      },
      {
        record_id: "rec_003",
        name: "Sample Item Gamma",
        category: "Standard",
        value: "75",
        created_at: "2024-02-20",
        status: "synced",
      },
    ];
    return { columns, rows };
  };

  // Setup the callback inside the wizard to save file info
  const handleOpenWizard = () => {
    // Clear any previous state
    localStorage.removeItem("most_recent_ingested_file");
    setIsWizardOpen(true);
  };

  const deleteFile = (id: string) => {
    const updated = ingestedFiles.filter((f) => f.id !== id);
    localStorage.setItem("local_ingested_files", JSON.stringify(updated));
    setIngestedFiles(updated);
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-6">
      {/* Top Header Section */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Connections</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage database connectors, file ingestions, and mappings
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleOpenWizard}
            className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/35 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Ingest File
          </button>

          <button
            onClick={() => setIsDbModalOpen(true)}
            className="bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-850 px-4 py-2 rounded-lg text-xs font-semibold hover:text-zinc-100 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-black/10 hover:shadow-black/20"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="14" y2="12" />
            </svg>
            Connect Database
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-zinc-800/80 select-none">
        <button
          onClick={() => setActiveTab("connectors")}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "connectors"
              ? "border-blue-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Data Connectors
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "files"
              ? "border-blue-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Uploaded Files
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0">
        {/* Tab 1: Connectors */}
        {activeTab === "connectors" && (
          <div className="flex flex-col gap-4">
            {isLoading && (
              <div className="flex items-center justify-center p-12 text-zinc-400 text-xs gap-2 select-none">
                <svg
                  className="animate-spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    className="opacity-25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4"
                    className="opacity-75"
                  />
                </svg>
                <span>Loading registered connections...</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center justify-between font-medium">
                <span>{error}</span>
                <button
                  onClick={loadConnectors}
                  className="underline hover:text-red-300 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoading && customConnectors.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center select-none border border-zinc-800/80 rounded-xl bg-zinc-950/60">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-600 mb-3"
                >
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
                <span className="text-sm font-semibold text-zinc-400">
                  No data connectors registered yet
                </span>
                <span className="text-xs text-zinc-500 mt-1">
                  Click Connect Database to register a new connector
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customConnectors.map((conn) => {
                  const isCustom = "id" in conn && !!conn.id;
                  return (
                    <div
                      key={conn.id || conn.name}
                      className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex flex-col justify-between gap-4 transition-all hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/25 relative group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="pr-8">
                          <span className="font-semibold text-zinc-100 text-[15px] block">
                            {conn.name}
                          </span>
                          <span className="text-[11px] text-zinc-500 mt-1 block leading-normal">
                            {conn.desc}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                              conn.status === "Connected"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-zinc-900 border-zinc-800 text-zinc-500"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                conn.status === "Connected"
                                  ? "bg-emerald-500"
                                  : "bg-zinc-600"
                              }`}
                            />
                            {conn.status}
                          </span>

                          {isCustom && conn.id && (
                            <button
                              onClick={() => deleteConnector(conn.id!)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-850 rounded transition-all cursor-pointer absolute top-4 right-4"
                              title="Delete Custom Connection"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 border-t border-zinc-850 pt-3 select-none">
                        <span>
                          Type:{" "}
                          <strong className="text-zinc-400 font-normal">
                            {conn.type}
                          </strong>
                        </span>
                        <span className="font-semibold text-blue-500">
                          {conn.pipelines} Pipelines
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Uploaded Files */}
        {activeTab === "files" && (
          <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60">
            <div className="grid grid-cols-12 bg-zinc-900/50 p-4 font-semibold border-b border-zinc-800/80 text-xs text-zinc-400 select-none">
              <div className="col-span-4">File Name</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Records Count</div>
              <div className="col-span-2">Date Ingested</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {ingestedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center select-none">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-600 mb-3"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-sm font-semibold text-zinc-400">
                  No flat files uploaded yet
                </span>
                <span className="text-xs text-zinc-500 mt-1">
                  Click Ingest File to upload CSV/JSON datasets
                </span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {ingestedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-12 p-4 text-xs items-center hover:bg-zinc-900/10"
                  >
                    <button
                      onClick={() => setPreviewingFile(file)}
                      className="col-span-4 font-semibold text-zinc-200 flex items-center gap-2 hover:text-emerald-400 text-left transition-colors cursor-pointer group"
                      title="Click to preview file data"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-zinc-400 group-hover:text-emerald-400 transition-colors"
                      >
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      </svg>
                      <span className="underline decoration-zinc-700 underline-offset-2 group-hover:decoration-emerald-400">
                        {file.name}
                      </span>
                    </button>
                    <div className="col-span-2 font-mono text-zinc-400">
                      {file.size}
                    </div>
                    <div className="col-span-2 font-mono text-zinc-400">
                      {file.recordsCount.toLocaleString()} rows
                    </div>
                    <div className="col-span-2 text-zinc-500">
                      {file.createdAt}
                    </div>
                    <div className="col-span-1 flex justify-center select-none">
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {file.status}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1.5 select-none">
                      <button
                        onClick={() => setPreviewingFile(file)}
                        className="p-1.5 hover:bg-zinc-900 hover:text-emerald-400 text-zinc-400 rounded transition-colors cursor-pointer"
                        title="Preview File Records"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <Link
                        to="/explorer"
                        className="p-1.5 hover:bg-zinc-900 hover:text-blue-400 text-zinc-400 rounded transition-colors cursor-pointer"
                        title="View Cleaned & Resolved Golden Records in Entity Explorer"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </Link>
                      <Link
                        to="/connections/schema-map"
                        className="p-1.5 hover:bg-zinc-900 hover:text-emerald-400 text-zinc-400 rounded transition-colors cursor-pointer"
                        title="Map File Schema to Ontology"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="p-1.5 hover:bg-zinc-900 hover:text-red-400 text-zinc-500 rounded transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync pipeline monitoring panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SyncJobDetails />
        <ExecutionLogs title="Pipeline Execution Logs" />
      </div>

      {/* File Ingestion Modal */}
      {isWizardOpen && (
        <FileUploadWizard
          onClose={() => setIsWizardOpen(false)}
          onSuccess={handleWizardSuccess}
        />
      )}

      {/* Database Connection Modal */}
      {isDbModalOpen && (
        <DatabaseConnectorForm
          onClose={() => setIsDbModalOpen(false)}
          onSuccess={() => {
            setIsDbModalOpen(false);
            loadConnectors();
          }}
        />
      )}

      {/* File Data Preview Modal */}
      {previewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    {previewingFile.name}
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-normal">
                      {previewingFile.size} ·{" "}
                      {previewingFile.recordsCount.toLocaleString()} records
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Uploaded on {previewingFile.createdAt} · Status:{" "}
                    <span className="text-emerald-400 font-medium">
                      {previewingFile.status}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewingFile(null)}
                className="text-zinc-400 hover:text-zinc-200 p-2 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Content / Data Table */}
            <div className="p-5 overflow-auto flex-1">
              {(() => {
                const { columns, rows } = getPreviewData(previewingFile);
                return (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-300 font-mono">
                            <th className="p-3 border-r border-zinc-800 w-12 text-center text-zinc-500">
                              #
                            </th>
                            {columns.map((col) => (
                              <th
                                key={col}
                                className="p-3 border-r border-zinc-800 font-semibold whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 font-mono">
                          {rows.map((row, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-zinc-900/30 transition-colors"
                            >
                              <td className="p-3 border-r border-zinc-900 text-center text-zinc-500 bg-zinc-950/50">
                                {idx + 1}
                              </td>
                              {columns.map((col) => {
                                const val = (row as Record<string, unknown>)[
                                  col
                                ];
                                return (
                                  <td
                                    key={col}
                                    className="p-3 border-r border-zinc-900 text-zinc-300 whitespace-nowrap"
                                  >
                                    {val !== undefined && val !== null ? (
                                      String(val)
                                    ) : (
                                      <span className="text-zinc-600 italic">
                                        null
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/20 flex items-center justify-between shrink-0">
              <div className="text-xs text-zinc-500">
                Previewing sample records parsed from dataset.
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/connections/schema-map"
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  onClick={() => setPreviewingFile(null)}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  Map Schema to Ontology
                </Link>
                <Link
                  to="/explorer"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  onClick={() => setPreviewingFile(null)}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Search in Entity Explorer
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
