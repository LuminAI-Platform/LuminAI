import React, { useState, useEffect } from "react";
import { FileUploadWizard } from "../../features/connections/components/FileUploadWizard";

interface IngestedFile {
  id: string;
  name: string;
  size: string;
  recordsCount: number;
  status: "Synced" | "Failed" | "Syncing";
  createdAt: string;
}

export const ConnectionsPage: React.FC = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);
  const [activeTab, setActiveTab] = useState<"connectors" | "files">("connectors");

  // Load files list from localStorage or initialize with mock data
  const loadFiles = () => {
    const stored = localStorage.getItem("local_ingested_files");
    if (stored) {
      setIngestedFiles(JSON.parse(stored));
    } else {
      const initialFiles: IngestedFile[] = [
        {
          id: "1",
          name: "users_gold_v2.csv",
          size: "14.2 MB",
          recordsCount: 48500,
          status: "Synced",
          createdAt: new Date(Date.now() - 4800000).toLocaleString(),
        },
        {
          id: "2",
          name: "sales_raw_parquet.json",
          size: "1.4 GB",
          recordsCount: 2900000,
          status: "Synced",
          createdAt: new Date(Date.now() - 36000000).toLocaleString(),
        },
      ];
      localStorage.setItem("local_ingested_files", JSON.stringify(initialFiles));
      setIngestedFiles(initialFiles);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

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
      if (!files.some(f => f.name === newFileObj.name)) {
        files.unshift({
          id: Math.random().toString(36).substring(7),
          name: newFileObj.name,
          size: newFileObj.size,
          recordsCount: newFileObj.recordsCount,
          status: "Synced",
          createdAt: new Date().toLocaleString(),
        });
        localStorage.setItem("local_ingested_files", JSON.stringify(files));
        localStorage.removeItem("most_recent_ingested_file");
      }
    }
    loadFiles();
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
          <p className="text-xs text-zinc-400 mt-1">Manage database connectors, file ingestions, and mappings</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleOpenWizard}
            className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/35 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Ingest File
          </button>
          
          <button
            disabled
            className="bg-zinc-900 text-zinc-500 border border-zinc-800 px-4 py-2 rounded-lg text-xs font-semibold opacity-60 cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: "Snowflake",
                status: "Connected",
                pipelines: 4,
                type: "Warehouse",
                desc: "Enterprise data cloud containing central business ledger analytics.",
              },
              {
                name: "AWS S3",
                status: "Connected",
                pipelines: 12,
                type: "Storage",
                desc: "Raw binary storage buckets syncing CSV/JSON/Parquet event dumps.",
              },
              {
                name: "Kafka Streams",
                status: "Connected",
                pipelines: 2,
                type: "Stream",
                desc: "Real-time user clickstream queues and transactions event topics.",
              },
              {
                name: "PostgreSQL",
                status: "Disconnected",
                pipelines: 0,
                type: "Database",
                desc: "Relational production database containing customer account profiles.",
              },
            ].map((conn) => (
              <div
                key={conn.name}
                className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex flex-col justify-between gap-4 transition-all hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/25"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-zinc-100 text-[15px] block">{conn.name}</span>
                    <span className="text-[11px] text-zinc-500 mt-1 block leading-normal">{conn.desc}</span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                      conn.status === "Connected"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        conn.status === "Connected" ? "bg-emerald-500" : "bg-zinc-600"
                      }`}
                    />
                    {conn.status}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 border-t border-zinc-850 pt-3 select-none">
                  <span>Type: <strong className="text-zinc-400 font-normal">{conn.type}</strong></span>
                  <span className="font-semibold text-blue-500">{conn.pipelines} Pipelines</span>
                </div>
              </div>
            ))}
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
                <span className="text-sm font-semibold text-zinc-400">No flat files uploaded yet</span>
                <span className="text-xs text-zinc-500 mt-1">Click Ingest File to upload CSV/JSON datasets</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {ingestedFiles.map((file) => (
                  <div key={file.id} className="grid grid-cols-12 p-4 text-xs items-center hover:bg-zinc-900/10">
                    <div className="col-span-4 font-semibold text-zinc-200 flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-zinc-400"
                      >
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      </svg>
                      {file.name}
                    </div>
                    <div className="col-span-2 font-mono text-zinc-400">{file.size}</div>
                    <div className="col-span-2 font-mono text-zinc-400">{file.recordsCount.toLocaleString()} rows</div>
                    <div className="col-span-2 text-zinc-500">{file.createdAt}</div>
                    <div className="col-span-1 flex justify-center select-none">
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {file.status}
                      </span>
                    </div>
                    <div className="col-span-1 text-right select-none">
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="p-1 hover:bg-zinc-900 hover:text-red-400 text-zinc-500 rounded transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Sync pipeline monitoring panel */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 select-none">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-zinc-100 font-semibold text-sm">Active Ingestion Pipelines & Logs</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Monitoring live Kafka batch publishers and Polars cleaning executors</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded font-mono">
              Speed: 14.2K rec/s
            </span>
            <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded font-mono">
              Load: 8.5%
            </span>
          </div>
        </div>

        {/* Console log widget */}
        <div className="bg-black/90 p-4 border border-zinc-850 rounded-lg font-mono text-[10px] text-zinc-300 flex flex-col gap-2 h-36 overflow-y-auto">
          <div><span className="text-zinc-600">[00:41:03]</span> <span className="text-emerald-500 font-bold">INFO</span> [Kafka] Connected to brokers at upstash-kafka-prod:9092</div>
          <div><span className="text-zinc-600">[00:41:05]</span> <span className="text-emerald-500 font-bold">INFO</span> [Data Engine] Polars processor threadpool instantiated. (8 workers)</div>
          <div><span className="text-zinc-600">[00:45:12]</span> <span className="text-emerald-500 font-bold">INFO</span> [MinIO] Health status OK. Bucket 'lumin-raw-bucket' ready.</div>
          <div><span className="text-zinc-600">[01:12:44]</span> <span className="text-blue-500 font-bold">SUCCESS</span> [Sync] Database schemas verified. Ontology structure mapped.</div>
        </div>
      </div>

      {/* File Ingestion Modal */}
      {isWizardOpen && (
        <FileUploadWizard
          onClose={() => setIsWizardOpen(false)}
          onSuccess={handleWizardSuccess}
        />
      )}
    </div>
  );
};
