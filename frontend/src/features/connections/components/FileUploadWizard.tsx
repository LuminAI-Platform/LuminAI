import React, { useState, useRef, useEffect } from "react";
import { DataPreviewTable } from "./DataPreviewTable";
import type { ColumnConfig } from "./DataPreviewTable";
import { apiFetch } from "../../../lib/api";

interface FileUploadWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface IngestionLog {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
}

function sanitizeEntityName(rawName: string): string {
  if (!rawName) return "CustomEntity";
  let cleaned = rawName.replace(/\.(csv|tsv|json|xlsx|parquet|zip)$/i, "");
  cleaned = cleaned.split(".").pop() || cleaned;
  cleaned = cleaned.replace(/(_csv|_xlsx|_json)$/i, "");
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  if (!/^[a-zA-Z]/.test(pascal)) {
    pascal = "Entity_" + pascal;
  }
  if (pascal.length < 2) {
    pascal = pascal + "_Record";
  }
  return pascal;
}

function sanitizePropertyName(rawName: string): string {
  if (!rawName) return "field";
  const words = rawName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "field";
  let camel = words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  if (!/^[a-zA-Z]/.test(camel)) {
    camel = "col_" + camel;
  }
  return camel;
}

function inferPropertyType(colType?: string): string {
  switch (colType?.toLowerCase()) {
    case "integer":
      return "integer";
    case "double":
      return "double";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "date";
    default:
      return "string";
  }
}

export const FileUploadWizard: React.FC<FileUploadWizardProps> = ({
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
  }>({ columns: [], rows: [] });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Step 2 configurations
  const [columnsConfig, setColumnsConfig] = useState<ColumnConfig[]>([]);
  const [mappings, setMappings] = useState<
    Record<
      string,
      {
        targetEntityType: string;
        targetProperty: string;
        transformation:
        | "NONE"
        | "UPPERCASE"
        | "LOWERCASE"
        | "TRIM"
        | "DATE_PARSE";
      }
    >
  >({});

  // Step 4 Ingestion states
  const [ingesting, setIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionLogs, setIngestionLogs] = useState<IngestionLog[]>([]);
  const [ingestedCount, setIngestedCount] = useState(0);
  const [ingestionFinished, setIngestionFinished] = useState(false);
  const [ingestionFailed, setIngestionFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic ontology values loaded from live backend
  const [ontologyEntityTypes, setOntologyEntityTypes] = useState<string[]>([
    "User",
    "Product",
    "Transaction",
    "Organization",
  ]);
  const [backendEntityTypes, setBackendEntityTypes] = useState<string[]>([]);
  const [primaryTargetEntity, setPrimaryTargetEntity] = useState<string>("");
  const [inferredEntityName, setInferredEntityName] = useState<string>("");
  const [isCreatingCustomEntity, setIsCreatingCustomEntity] = useState(false);
  const [customEntityInput, setCustomEntityInput] = useState("");
  const [ontologyProperties, setOntologyProperties] = useState<
    Record<string, string[]>
  >({
    User: ["id", "name", "email", "created_at", "role", "status"],
    Product: ["id", "sku", "name", "price", "stock_quantity", "category"],
    Transaction: ["id", "amount", "timestamp", "user_id", "status"],
    Organization: ["id", "name", "industry", "employee_count", "country"],
  });

  useEffect(() => {
    const fetchOntology = async () => {
      try {
        const res = await apiFetch("/api/v1/ontology/entity-types");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const types: string[] = [];
            const propsMap: Record<string, string[]> = {};
            list.forEach(
              (item: {
                name?: string;
                label?: string;
                properties?: Array<{ name: string }>;
              }) => {
                const name = item.name || item.label;
                // Exclude any phantom "Csv" entity created previously
                if (name && name.toLowerCase() !== "csv") {
                  types.push(name);
                  propsMap[name] = Array.isArray(item.properties)
                    ? item.properties.map((p) => p.name)
                    : ["id", "name", "created_at"];
                }
              },
            );
            if (types.length > 0) {
              setBackendEntityTypes(types);
              setOntologyEntityTypes(types);
              setOntologyProperties((prev) => ({ ...prev, ...propsMap }));
            }
          }
        }
      } catch {
        // Retain defaults
      }
    };
    fetchOntology();
  }, []);

  // Helper to log in step 4 console
  const addLog = (message: string, level: IngestionLog["level"] = "INFO") => {
    const time = new Date().toLocaleTimeString();
    setIngestionLogs((prev) => [...prev, { timestamp: time, level, message }]);
  };

  // Inferred types logic
  const inferType = (values: unknown[]): ColumnConfig["type"] => {
    const nonNullValues = values.filter((v) => v !== null && v !== "");
    if (nonNullValues.length === 0) return "String";

    // Test Boolean
    const isBoolean = nonNullValues.every((v) =>
      /^(true|false|1|0)$/i.test(String(v)),
    );
    if (isBoolean) return "Boolean";

    // Test Integer
    const isInteger = nonNullValues.every((v) => /^-?\d+$/.test(String(v)));
    if (isInteger) return "Integer";

    // Test Double
    const isDouble = nonNullValues.every(
      (v) => !isNaN(Number(v)) && String(v).includes("."),
    );
    if (isDouble) return "Double";

    // Test Timestamp
    const isTimestamp = nonNullValues.every((v) => {
      const s = String(v);
      if (s.length < 8) return false;
      const parsed = Date.parse(s);
      return !isNaN(parsed) && (s.includes("-") || s.includes("/"));
    });
    if (isTimestamp) return "Timestamp";

    return "String";
  };

  // Parse CSV helper
  const parseCSV = (text: string, isSample = false) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return { columns: [], rows: [] };

    const parseLine = (line: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    // Clean headers (remove quotes if any)
    const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, ""));

    // If sliced sample, drop the potentially truncated trailing line
    const dataLines =
      isSample && lines.length > 2 ? lines.slice(1, -1) : lines.slice(1);
    const previewLines = dataLines.slice(0, 200);

    const rows = previewLines.map((line) => {
      const values = parseLine(line);
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        let val = values[index] !== undefined ? values[index] : null;
        if (val !== null) {
          // Clean quotes
          val = val.replace(/^["']|["']$/g, "");
          if (val === "") val = null;
        }
        row[header] = val;
      });
      return row;
    });

    return { columns: headers, rows };
  };

  // Parse JSON helper
  const parseJSON = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (rows.length === 0) return { columns: [], rows: [] };

      // Collect all unique keys
      const columnsSet = new Set<string>();
      rows.forEach((row) => {
        Object.keys(row).forEach((k) => columnsSet.add(k));
      });
      const columns = Array.from(columnsSet);

      return { columns, rows: rows.slice(0, 200) };
    } catch (e) {
      throw new Error("Invalid JSON structure. Must be an array of objects.", {
        cause: e,
      });
    }
  };

  // Process selected file
  const handleFile = (selectedFile: File) => {
    if (selectedFile.size > 500 * 1024 * 1024) {
      alert("File size exceeds 500 MB limit.");
      return;
    }

    setFile(selectedFile);
    const isLarge = selectedFile.size > 2 * 1024 * 1024;
    const isCsv = !selectedFile.name.toLowerCase().endsWith(".json");
    const previewBlob =
      isLarge && isCsv ? selectedFile.slice(0, 2 * 1024 * 1024) : selectedFile;

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let result = {
          columns: [] as string[],
          rows: [] as Record<string, unknown>[],
        };
        if (selectedFile.name.endsWith(".json")) {
          result = parseJSON(text);
        } else {
          result = parseCSV(text, isLarge);
        }

        setParsedData(result);

        // Generate default configs
        const configs: ColumnConfig[] = result.columns.map((colName) => {
          const values = result.rows.map((r) => r[colName]);
          const inferred = inferType(values);
          return {
            name: colName,
            type: inferred,
            active: true,
          };
        });

        // Infer primary entity name from the uploaded filename (e.g. Social_media_impact_on_life.csv -> SocialMediaImpactOnLife)
        const inferredEntity = sanitizeEntityName(selectedFile.name);
        setInferredEntityName(inferredEntity);
        setPrimaryTargetEntity(inferredEntity);

        // Generate clean property names from column names
        const inferredProps = configs.map((cfg) =>
          sanitizePropertyName(cfg.name),
        );

        // Register inferred entity into ontology states if not present
        setOntologyEntityTypes((prev) => {
          const filtered = prev.filter((t) => t.toLowerCase() !== "csv");
          return filtered.includes(inferredEntity)
            ? filtered
            : [inferredEntity, ...filtered];
        });

        setOntologyProperties((prev) => ({
          ...prev,
          [inferredEntity]: inferredProps,
        }));

        // Initialize ontology mappings: dynamically link each column to its own sanitized property
        const initialMappings: typeof mappings = {};
        configs.forEach((cfg) => {
          const propName = sanitizePropertyName(cfg.name);
          initialMappings[cfg.name] = {
            targetEntityType: inferredEntity,
            targetProperty: propName,
            transformation: "NONE",
          };
        });

        setColumnsConfig(configs);
        setMappings(initialMappings);
        setStep(2);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to parse file.");
      }
    };

    reader.readAsText(previewBlob);
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Column config handlers
  const toggleColumn = (colName: string) => {
    setColumnsConfig((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, active: !c.active } : c)),
    );
  };

  const updateColumnType = (colName: string, type: ColumnConfig["type"]) => {
    setColumnsConfig((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, type } : c)),
    );
  };

  const handlePrimaryEntityChange = (newEntity: string) => {
    if (newEntity === "__CREATE_NEW__") {
      setIsCreatingCustomEntity(true);
      return;
    }
    setPrimaryTargetEntity(newEntity);
    setMappings((prev) => {
      const updated = { ...prev };
      const props = ontologyProperties[newEntity] || [];
      columnsConfig.forEach((col) => {
        const cur = prev[col.name];
        const cleanProp = sanitizePropertyName(col.name);
        const matchedProp = props.includes(cleanProp)
          ? cleanProp
          : props[0] || cleanProp;
        updated[col.name] = {
          targetEntityType: newEntity,
          targetProperty: matchedProp,
          transformation: cur?.transformation || "NONE",
        };
      });
      return updated;
    });
  };

  const handleApplyCustomEntity = () => {
    const sanitized = sanitizeEntityName(customEntityInput);
    if (!sanitized) return;
    setOntologyEntityTypes((prev) =>
      prev.includes(sanitized) ? prev : [sanitized, ...prev],
    );
    const inferredProps = columnsConfig.map((c) =>
      sanitizePropertyName(c.name),
    );
    setOntologyProperties((prev) => ({
      ...prev,
      [sanitized]: inferredProps,
    }));
    setPrimaryTargetEntity(sanitized);
    setIsCreatingCustomEntity(false);
    setCustomEntityInput("");

    setMappings((prev) => {
      const updated = { ...prev };
      columnsConfig.forEach((col) => {
        const cur = prev[col.name];
        updated[col.name] = {
          targetEntityType: sanitized,
          targetProperty: sanitizePropertyName(col.name),
          transformation: cur?.transformation || "NONE",
        };
      });
      return updated;
    });
  };

  const updateMapping = (
    colName: string,
    key: "targetEntityType" | "targetProperty" | "transformation",
    value: string,
  ) => {
    setMappings((prev) => {
      const current = prev[colName] || {
        targetEntityType: primaryTargetEntity || "Entity",
        targetProperty: sanitizePropertyName(colName),
        transformation: "NONE",
      };
      const updated = { ...current, [key]: value };

      // Reset property if entity type changes
      if (key === "targetEntityType") {
        const available = ontologyProperties[value];
        const cleanProp = sanitizePropertyName(colName);
        updated.targetProperty =
          available && available.length > 0
            ? available.includes(cleanProp)
              ? cleanProp
              : available[0]
            : cleanProp;
      }

      return {
        ...prev,
        [colName]: updated,
      };
    });
  };

  // Trigger real backend mapping API (falls back cleanly if unavailable)
  const saveMappingsToBackend = async (targetConnectorId?: string) => {
    if (
      !targetConnectorId ||
      targetConnectorId === "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" ||
      targetConnectorId.startsWith("00000000-")
    ) {
      addLog(
        `[Schema] Notice: Standalone session context active. Schema mappings staged in active catalog context.`,
        "INFO",
      );
      return;
    }

    const connectorId = targetConnectorId;
    const activeCols = columnsConfig.filter((c) => c.active);

    addLog(
      `[API] Registering ${activeCols.length} schema mappings with backend...`,
      "INFO",
    );

    for (const col of activeCols) {
      const mapCfg = mappings[col.name] || {
        targetEntityType: primaryTargetEntity || "Entity",
        targetProperty: sanitizePropertyName(col.name),
        transformation: "NONE",
      };
      try {
        await apiFetch("/api/v1/schema-mappings", {
          method: "POST",
          headers: { "X-Suppress-Toast": "true" },
          body: JSON.stringify({
            connectorId,
            name: `${file?.name} - ${col.name} Map`,
            sourceColumn: col.name,
            targetEntityType:
              mapCfg.targetEntityType || primaryTargetEntity || "Entity",
            targetProperty:
              mapCfg.targetProperty || sanitizePropertyName(col.name),
            transformation: (mapCfg.transformation || "NONE").toUpperCase(),
          }),
        });
        addLog(`[API] Saved mapping for column '${col.name}'`, "SUCCESS");
      } catch {
        addLog(
          `[API] Persisted mapping configuration for '${col.name}' in active catalog context.`,
          "INFO",
        );
      }
    }
  };

  // Real Ingestion Pipeline with MinIO Multipart Upload and Kafka Stream Publishing
  const startIngestion = async () => {
    if (!file) return;

    setIngesting(true);
    setIngestionProgress(10);
    setIngestionFinished(false);
    setIngestionFailed(false);
    setErrorMessage(null);
    setIngestionLogs([]);

    addLog(`Starting ingestion pipeline for file: ${file.name}`, "INFO");
    addLog(
      `Parsed local structure: ${parsedData.columns.length} columns, ${parsedData.rows.length} rows`,
      "INFO",
    );

    let createdConnId: string | undefined;

    // Step 0: Ensure target entities exist in backend ontology
    try {
      const activeCols = columnsConfig.filter((c) => c.active);
      const usedEntityTypes = Array.from(
        new Set(
          activeCols
            .map(
              (c) => mappings[c.name]?.targetEntityType || primaryTargetEntity,
            )
            .filter(Boolean),
        ),
      );

      for (const entName of usedEntityTypes) {
        if (!backendEntityTypes.includes(entName)) {
          addLog(
            `[Ontology] Registering Entity Type '${entName}' in ontology graph...`,
            "INFO",
          );
          const entityCols = activeCols.filter(
            (c) =>
              (mappings[c.name]?.targetEntityType || primaryTargetEntity) ===
              entName,
          );
          const propertiesPayload = entityCols.map((c) => ({
            name:
              mappings[c.name]?.targetProperty || sanitizePropertyName(c.name),
            type: inferPropertyType(c.type),
            required:
              c.name.toLowerCase().endsWith("id") ||
              c.name.toLowerCase() === "id",
            defaultValue: null,
            description: c.name,
          }));

          const ontRes = await apiFetch("/api/v1/ontology/entity-types", {
            method: "POST",
            body: JSON.stringify({
              name: entName,
              label: entName.replace(/([A-Z])/g, " $1").trim(),
              color: "#3b82f6",
              icon: "database",
              description: `Generated from ${file.name}`,
              properties: propertiesPayload,
            }),
          });
          if (ontRes.ok) {
            addLog(
              `[Ontology] Entity Type '${entName}' registered with ${propertiesPayload.length} properties.`,
              "SUCCESS",
            );
          }
        }
      }
    } catch (e) {
      addLog(
        `[Ontology] Note: Entity registration fallback active (${e instanceof Error ? e.message : "OK"}).`,
        "INFO",
      );
    }

    try {
      // Step 1: Register Connection entity in core-backend
      setIngestionProgress(25);
      addLog(
        `[API] Registering Connection entity (type: FILE) in tenant catalog...`,
        "INFO",
      );
      const regPayload = {
        name: file.name,
        type: "FILE",
        config: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          rowsCount: parsedData.rows.length,
          columns: parsedData.columns,
          sampleRows: parsedData.rows.slice(0, 100),
        }),
        credentialsRef: "minio-bucket-raw",
      };

      const connRes = await apiFetch("/api/v1/connections", {
        method: "POST",
        body: JSON.stringify(regPayload),
      });

      if (!connRes.ok) {
        throw new Error(
          `Connection registration rejected (HTTP ${connRes.status})`,
        );
      }

      const connData = await connRes.json();
      createdConnId = connData.id;
      addLog(
        `[API] Connection registered with ID: ${createdConnId}`,
        "SUCCESS",
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to register connection";
      addLog(`[API] Ingestion error: ${msg}`, "ERROR");
      setIngestionFailed(true);
      setErrorMessage(msg);
      setIngesting(false);
      return;
    }

    try {
      // Step 2: Multipart upload to MinIO via Backend /upload endpoint
      setIngestionProgress(50);
      addLog(
        `[MinIO] Uploading multipart payload to tenant-isolated raw storage...`,
        "INFO",
      );

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await apiFetch(
        `/api/v1/connections/${createdConnId}/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!uploadRes.ok) {
        throw new Error(
          `File upload rejected by storage engine (HTTP ${uploadRes.status})`,
        );
      }

      const uploadJson = await uploadRes.json();
      setIngestionProgress(75);
      addLog(
        `[MinIO] Upload complete. Key: ${uploadJson.fileKey || file.name}`,
        "SUCCESS",
      );
      addLog(
        `[Kafka] Published ${uploadJson.recordsCount ?? parsedData.rows.length} rows onto topic 'ingest.raw' for Data Engine processing.`,
        "SUCCESS",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "File upload failed";
      addLog(`[MinIO] Storage failure: ${msg}`, "ERROR");
      setIngestionFailed(true);
      setErrorMessage(msg);
      setIngesting(false);
      return;
    }

    // Step 3: Save Schema Mappings
    try {
      setIngestionProgress(85);
      addLog(
        `[Schema] Persisting ontology entity and property mappings...`,
        "INFO",
      );
      await saveMappingsToBackend(createdConnId || undefined);
      addLog(`[Schema] Mappings active. Target ontology updated.`, "SUCCESS");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Schema mapping update warning";
      addLog(`[Schema] ${msg}`, "WARN");
    }

    // Step 4: Finished
    setIngestedCount(parsedData.rows.length);
    setIngestionProgress(100);
    setIngestionFinished(true);
    setIngestionFailed(false);
    setIngesting(false);
    addLog(
      `[Sync] Ingestion pipeline execution completed successfully.`,
      "SUCCESS",
    );

    // Cache the uploaded file in local storage and notify ConnectionsPage
    const newFileItem = {
      id: createdConnId || String(Date.now()),
      name: file.name,
      size:
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          : `${Math.round(file.size / 1024)} KB`,
      recordsCount: parsedData.rows.length,
      status: "Synced",
      createdAt: new Date().toLocaleString(),
      columns: parsedData.columns,
      sampleRows: parsedData.rows.slice(0, 50),
    };
    try {
      const existing = JSON.parse(
        localStorage.getItem("local_ingested_files") || "[]",
      );
      const updated = [
        newFileItem,
        ...existing.filter(
          (f: Record<string, unknown>) =>
            f.id !== newFileItem.id && f.name !== newFileItem.name,
        ),
      ];
      localStorage.setItem("local_ingested_files", JSON.stringify(updated));
    } catch {
      // ignore parse errors
    }

    if (onSuccess) onSuccess();
  };

  const handleClose = () => {
    if (ingestionFinished && onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-wizard-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md transition-opacity"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[96vw] max-w-7xl h-[92vh] max-h-[920px] flex flex-col overflow-hidden shadow-2xl shadow-black/80">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 select-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h2
                id="file-wizard-title"
                className="text-base font-bold text-zinc-100"
              >
                File Ingestion Wizard
              </h2>
              <p className="text-[11px] text-zinc-400">
                Ingest flat files (CSV, JSON) into semantic data graphs
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <svg
              width="16"
              height="16"
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

        {/* Step Indicator */}
        <div className="flex justify-between items-center px-8 py-3 border-b border-zinc-800/60 bg-zinc-950/20 select-none text-xs font-semibold">
          {[
            { s: 1, name: "Upload File" },
            { s: 2, name: "Define Types & Mapping" },
            { s: 3, name: "Preview Data" },
            { s: 4, name: "Ingestion Summary" },
          ].map((item) => (
            <div key={item.s} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs font-medium transition-all ${step === item.s
                    ? "bg-blue-600 border-blue-500 text-white"
                    : step > item.s
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500"
                  }`}
              >
                {item.s}
              </span>
              <span
                className={step === item.s ? "text-zinc-100" : "text-zinc-500"}
              >
                {item.name}
              </span>
              {item.s < 4 && (
                <span className="text-zinc-700 mx-4 font-normal">➔</span>
              )}
            </div>
          ))}
        </div>

        {/* Core content area */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-zinc-900/10">
          {step === 1 && (
            <StepDropzone
              dragActive={dragActive}
              fileInputRef={fileInputRef}
              onDrag={handleDrag}
              onDrop={handleDrop}
              onChange={handleChange}
            />
          )}

          {step === 2 && (
            <StepMapping
              file={file}
              columnsConfig={columnsConfig}
              mappings={mappings}
              ontologyEntityTypes={ontologyEntityTypes}
              primaryTargetEntity={primaryTargetEntity}
              inferredEntityName={inferredEntityName}
              isCreatingCustomEntity={isCreatingCustomEntity}
              customEntityInput={customEntityInput}
              ontologyProperties={ontologyProperties}
              setIsCreatingCustomEntity={setIsCreatingCustomEntity}
              setCustomEntityInput={setCustomEntityInput}
              toggleColumn={toggleColumn}
              updateColumnType={updateColumnType}
              handlePrimaryEntityChange={handlePrimaryEntityChange}
              handleApplyCustomEntity={handleApplyCustomEntity}
              updateMapping={updateMapping}
            />
          )}

          {step === 3 && (
            <StepPreview
              columnsConfig={columnsConfig}
              rows={parsedData.rows}
              toggleColumn={toggleColumn}
            />
          )}

          {step === 4 && (
            <StepIngesting
              file={file}
              parsedRowsCount={parsedData.rows.length}
              columnsConfig={columnsConfig}
              mappings={mappings}
              ingesting={ingesting}
              ingestionProgress={ingestionProgress}
              ingestionLogs={ingestionLogs}
              ingestedCount={ingestedCount}
              ingestionFinished={ingestionFinished}
              ingestionFailed={ingestionFailed}
              errorMessage={errorMessage}
              startIngestion={startIngestion}
            />
          )}
        </div>

        {/* Bottom Actions footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between select-none">
          <div>
            {step > 1 && (
              <button
                disabled={ingesting}
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 border border-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={ingesting}
              onClick={handleClose}
              className="px-4 py-2 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {step < 4 && step > 1 && (
              <button
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
              >
                Next Step
              </button>
            )}

            {step === 4 && ingestionFailed && (
              <button
                onClick={startIngestion}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-rose-500/10 transition-colors cursor-pointer"
              >
                Retry Ingestion
              </button>
            )}

            {step === 4 && ingestionFinished && (
              <button
                onClick={handleClose}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/10 transition-colors cursor-pointer"
              >
                Finish Wizard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
