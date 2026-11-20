import React, { useState, useEffect } from "react";
import { Wand2, Database, Layers, Check } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { DOMAIN_STARTER_PACKS, type DomainTemplate } from "../domainTemplates";
import { AutoGenerateFromDataset } from "./AutoGenerateFromDataset";
import { AutoGenerateFromTemplate } from "./AutoGenerateFromTemplate";
import {
  type ConnectionSummary,
  type InferredProp,
  type AutoGenerateModalProps,
  sanitizeEntityName,
  sanitizePropertyName,
  inferTypeFromDataType,
} from "./autoGenerateUtils";

export { type AutoGenerateModalProps };

export const AutoGenerateModal: React.FC<AutoGenerateModalProps> = ({
  open,
  onClose,
  onGenerated,
}) => {
  const [activeTab, setActiveTab] = useState<"dataset" | "template">("dataset");

  // Dataset states
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConn, setSelectedConn] = useState<ConnectionSummary | null>(null);
  const [entityName, setEntityName] = useState("");
  const [entityLabel, setEntityLabel] = useState("");
  const [entityColor, setEntityColor] = useState("#3b82f6");
  const [entityIcon, setEntityIcon] = useState("database");
  const [inferredProps, setInferredProps] = useState<InferredProp[]>([]);

  // Template states
  const [selectedTemplate, setSelectedTemplate] = useState<DomainTemplate>(
    DOMAIN_STARTER_PACKS[0],
  );

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSelectConnection = (conn: ConnectionSummary) => {
    setSelectedConn(conn);
    setError(null);

    const derivedName = sanitizeEntityName(conn.name);
    setEntityName(derivedName);
    setEntityLabel(derivedName.replace(/([A-Z])/g, " $1").trim());

    let cols: string[] = [];
    if (conn.config) {
      try {
        const parsed =
          typeof conn.config === "string" ? JSON.parse(conn.config) : conn.config;
        if (Array.isArray(parsed.columns)) {
          cols = parsed.columns;
        } else if (
          Array.isArray(parsed.sampleRows) &&
          parsed.sampleRows.length > 0
        ) {
          cols = Object.keys(parsed.sampleRows[0]);
        }
      } catch {
        // Fallback
      }
    }

    if (cols.length === 0) {
      setError("No schema columns found in the connection configuration.");
      setInferredProps([]);
      return;
    }

    const props: InferredProp[] = cols.map((c) => ({
      name: sanitizePropertyName(c),
      type: inferTypeFromDataType(c),
      required:
        c.toLowerCase() === "id" ||
        c.toLowerCase().endsWith("_id") ||
        c.toLowerCase().endsWith("id"),
      description: `Inferred from column '${c}'`,
    }));

    setInferredProps(props);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccessMsg(null);
    setLoadingConnections(true);
    apiFetch("/api/v1/connections")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConnections(data);
          if (data.length > 0) {
            handleSelectConnection(data[0]);
          }
        }
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load connections"),
      )
      .finally(() => setLoadingConnections(false));
  }, [open]);

  const handleSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      onGenerated();
      onClose();
    }, 1100);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      maxWidth="3xl"
      hideHeader={true}
    >
      <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Auto-Generate Ontology Models
              </h2>
              <p className="text-[11px] text-zinc-500">
                Generate dynamic schema definitions directly from ingested data sources or industry templates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-900/30">
          <button
            type="button"
            onClick={() => {
              setActiveTab("dataset");
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "dataset"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            From Ingested Dataset
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("template");
              setError(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "template"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            From Industry Template
          </button>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-950/30 border border-red-500/20 text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === "dataset" ? (
            <AutoGenerateFromDataset
              connections={connections}
              loadingConnections={loadingConnections}
              selectedConn={selectedConn}
              onSelectConnection={handleSelectConnection}
              entityName={entityName}
              setEntityName={setEntityName}
              entityLabel={entityLabel}
              setEntityLabel={setEntityLabel}
              entityColor={entityColor}
              setEntityColor={setEntityColor}
              entityIcon={entityIcon}
              setEntityIcon={setEntityIcon}
              inferredProps={inferredProps}
              onSuccess={handleSuccess}
              onError={setError}
              onClose={onClose}
            />
          ) : (
            <AutoGenerateFromTemplate
              selectedTemplate={selectedTemplate}
              setSelectedTemplate={setSelectedTemplate}
              onSuccess={handleSuccess}
              onError={setError}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};
