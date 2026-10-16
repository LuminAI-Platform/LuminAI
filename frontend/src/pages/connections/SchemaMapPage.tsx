import React, { useState, useEffect } from "react";
import { History, Layers } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  VisualSchemaMapper,
  type SourceColumn,
  type OntologyProperty,
  type SchemaMappingPayload,
} from "../../features/connections/components/VisualSchemaMapper";

export const SchemaMapPage: React.FC = () => {
  const [sources, setSources] = useState<
    Record<string, { table: string; columns: SourceColumn[] }>
  >({});
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedOntology, setSelectedOntology] = useState<string>("");
  const [savedMappings, setSavedMappings] = useState<SchemaMappingPayload[]>(
    [],
  );
  const [showHistory, setShowHistory] = useState(false);
  const [dynamicOntologyMap, setDynamicOntologyMap] = useState<
    Record<string, OntologyProperty[]>
  >({});
  const [dynamicOntologyLabels, setDynamicOntologyLabels] = useState<
    Record<string, string>
  >({});

  // Fetch live connectors from backend GET /api/v1/connections
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await apiFetch("/api/v1/connections");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const newSources: Record<
              string,
              { table: string; columns: SourceColumn[] }
            > = {};
            const newLabels: Record<string, string> = {};
            list.forEach(
              (c: {
                id: string;
                name: string;
                type: string;
                config?: string | Record<string, unknown>;
              }) => {
                let parsedConfig: Record<string, unknown> = {};
                if (typeof c.config === "string") {
                  try {
                    parsedConfig = JSON.parse(c.config);
                  } catch {
                    // ignore
                  }
                } else if (c.config && typeof c.config === "object") {
                  parsedConfig = c.config as Record<string, unknown>;
                }

                // If multi-table archive bundle:
                if (
                  Array.isArray(parsedConfig.tables) &&
                  parsedConfig.tables.length > 0
                ) {
                  parsedConfig.tables.forEach(
                    (
                      tbl: {
                        fileName?: string;
                        columns?: string[];
                        sampleRows?: Record<string, unknown>[];
                      },
                      tIdx: number,
                    ) => {
                      const tblName = tbl.fileName || `table_${tIdx + 1}`;
                      const subKey = `conn_${c.id}_${tblName}`;
                      newLabels[subKey] = `Live: ${c.name} > ${tblName}`;

                      const cols: SourceColumn[] = [];
                      const colNames = Array.isArray(tbl.columns)
                        ? tbl.columns
                        : [];
                      const sampleRow =
                        Array.isArray(tbl.sampleRows) && tbl.sampleRows[0]
                          ? tbl.sampleRows[0]
                          : {};

                      colNames.forEach((colName: string, cIdx: number) => {
                        const val = sampleRow[colName];
                        let dType: SourceColumn["dataType"] = "string";
                        if (typeof val === "number") {
                          dType = Number.isInteger(val) ? "integer" : "float";
                        } else if (typeof val === "boolean") {
                          dType = "boolean";
                        } else if (typeof val === "string") {
                          if (
                            !isNaN(Date.parse(val)) &&
                            (val.includes("-") || val.includes("/"))
                          ) {
                            dType = "timestamp";
                          }
                        }
                        cols.push({
                          id: `col_${cIdx + 1}`,
                          name: colName,
                          dataType: dType,
                          sample:
                            val !== undefined && val !== null
                              ? String(val)
                              : "—",
                          nullable: true,
                        });
                      });

                      if (cols.length === 0) return;

                      newSources[subKey] = {
                        table: `${c.name}.${tblName}`,
                        columns: cols,
                      };
                    },
                  );
                  return;
                }

                // Single dataset file or database connector
                const key = `conn_${c.id}`;
                newLabels[key] = `Live: ${c.name} (${c.type})`;

                const cols: SourceColumn[] = [];
                const colNames = Array.isArray(parsedConfig.columns)
                  ? (parsedConfig.columns as string[])
                  : [];
                const sampleRow =
                  Array.isArray(parsedConfig.sampleRows) &&
                  parsedConfig.sampleRows[0]
                    ? (parsedConfig.sampleRows[0] as Record<string, unknown>)
                    : {};

                colNames.forEach((colName: string, cIdx: number) => {
                  const val = sampleRow[colName];
                  let dType: SourceColumn["dataType"] = "string";
                  if (typeof val === "number") {
                    dType = Number.isInteger(val) ? "integer" : "float";
                  } else if (typeof val === "boolean") {
                    dType = "boolean";
                  } else if (typeof val === "string") {
                    if (
                      !isNaN(Date.parse(val)) &&
                      (val.includes("-") || val.includes("/"))
                    ) {
                      dType = "timestamp";
                    }
                  }
                  cols.push({
                    id: `col_${cIdx + 1}`,
                    name: colName,
                    dataType: dType,
                    sample:
                      val !== undefined && val !== null ? String(val) : "—",
                    nullable: true,
                  });
                });

                newSources[key] = {
                  table: `${c.type}.${c.name.replace(/\s+/g, "_").toUpperCase()}`,
                  columns: cols,
                };
              },
            );
            setSources(newSources);
            setSourceLabels(newLabels);

            // Pre-select connection from URL parameter or localStorage
            const preferredId =
              new URLSearchParams(window.location.search).get("connectionId") ||
              localStorage.getItem("lumin_selected_connection_id");

            if (preferredId) {
              const matchKey = Object.keys(newSources).find((k) =>
                k.includes(preferredId),
              );
              if (matchKey) {
                setSelectedSource(matchKey);
              } else if (list.length > 0) {
                setSelectedSource(`conn_${list[0].id}`);
              }
              localStorage.removeItem("lumin_selected_connection_id");
            } else if (list.length > 0) {
              setSelectedSource(`conn_${list[0].id}`);
            }
          }
        }
      } catch {
        // Retain templates
      }
    };
    fetchConnections();
  }, []);

  // Fetch live ontology entity types from backend API GET /api/v1/ontology/entity-types
  useEffect(() => {
    const fetchOntologyTypes = async () => {
      try {
        const res = await apiFetch("/api/v1/ontology/entity-types");
        if (res.ok) {
          const types = await res.json();
          if (Array.isArray(types) && types.length > 0) {
            const newMap: Record<string, OntologyProperty[]> = {};
            const newLabels: Record<string, string> = {};

            types.forEach(
              (t: {
                name: string;
                label?: string;
                properties?: Array<{
                  name: string;
                  dataType?: string;
                  required?: boolean;
                  description?: string;
                }>;
              }) => {
                newLabels[t.name] = t.label || t.name;
                if (t.properties && Array.isArray(t.properties)) {
                  newMap[t.name] = t.properties.map((p, idx) => ({
                    id: p.name || `p_${idx}`,
                    name: p.name,
                    entityClass: t.name,
                    expectedType: p.dataType || "string",
                    required: Boolean(p.required),
                    description: p.description || p.name,
                  }));
                } else if (!newMap[t.name]) {
                  newMap[t.name] = [
                    {
                      id: "id",
                      name: "id",
                      entityClass: t.name,
                      expectedType: "string",
                      required: true,
                      description: "Entity ID",
                    },
                    {
                      id: "name",
                      name: "name",
                      entityClass: t.name,
                      expectedType: "string",
                      required: true,
                      description: "Canonical name",
                    },
                  ];
                }
              },
            );

            setDynamicOntologyMap(newMap);
            setDynamicOntologyLabels(newLabels);
            if (types[0]?.name) {
              setSelectedOntology(types[0].name);
            }
          }
        }
      } catch {
        // Ontology fetch failed
      }
    };
    fetchOntologyTypes();
  }, []);

  // Fetch saved mapping history from backend API GET /api/v1/schema-mappings
  useEffect(() => {
    const fetchSavedMappings = async () => {
      try {
        const res = await apiFetch("/api/v1/schema-mappings");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const normalised: SchemaMappingPayload[] = data.map(
              (item: Record<string, unknown>) => {
                if (item.sourceTable && item.mappings) {
                  return item as unknown as SchemaMappingPayload;
                }
                return {
                  connectionId: String(
                    item.connectorId ?? item.connectionId ?? "",
                  ),
                  sourceTable: String(
                    item.name ?? item.sourceColumn ?? "source_table",
                  ),
                  targetEntity: String(
                    item.targetEntityType ?? item.targetEntity ?? "Entity",
                  ),
                  mappings: [
                    {
                      sourceColumnId: String(item.sourceColumn ?? ""),
                      ontologyPropertyId: String(item.targetProperty ?? ""),
                    },
                  ],
                  createdAt: String(item.createdAt ?? new Date().toISOString()),
                };
              },
            );
            setSavedMappings(normalised);
          }
        }
      } catch {
        // Saved mappings unavailable
      }
    };
    fetchSavedMappings();
  }, []);

  const handleSave = (payload: SchemaMappingPayload) => {
    setSavedMappings((prev) => [payload, ...prev.slice(0, 4)]);
  };

  const sourceData = sources[selectedSource] || { table: "", columns: [] };
  const ontologyProps = dynamicOntologyMap[selectedOntology] ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page Header */}
      <div className="mb-4 shrink-0">
        <PageHeader
          breadcrumbs={[
            { label: "Data Integration", to: "/connections" },
            { label: "Schema Studio" },
          ]}
          title="Schema Studio & Mapping"
          description="Map source schema columns to core ontology properties and configure data transformation rules."
          icon={<Layers className="w-5 h-5 text-blue-400" />}
          badge={{
            label: "Active Schema",
            variant: "blue",
          }}
          actions={
            <button
              id="schema-map-history-toggle"
              onClick={() => setShowHistory((h) => !h)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-zinc-400" />
              <span>History ({savedMappings.length})</span>
            </button>
          }
        />
      </div>

      {/* ── Source / Target Selectors ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 shrink-0 select-none">
        {/* Source selector */}
        <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            Source Table
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(sourceLabels).map((key) => (
              <button
                key={key}
                id={`source-select-${key}`}
                onClick={() => setSelectedSource(key)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                  selectedSource === key
                    ? "bg-blue-600 border-blue-500/40 text-white shadow-lg shadow-blue-500/15"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {sourceLabels[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Ontology selector */}
        <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            Target Ontology Entity
          </p>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(dynamicOntologyLabels).map((key) => (
              <button
                key={key}
                id={`ontology-select-${key}`}
                onClick={() => setSelectedOntology(key)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                  selectedOntology === key
                    ? "bg-emerald-600 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/15"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {dynamicOntologyLabels[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mapping History Drawer ── */}
      {showHistory && (
        <div className="mb-4 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex-shrink-0">
          <p className="text-xs font-semibold text-zinc-300 mb-3">
            Saved Mapping Configs
          </p>
          {savedMappings.length === 0 ? (
            <p className="text-[11px] text-zinc-600">
              No mappings saved yet. Build a mapping and click Save.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {savedMappings.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-400">
                      {(m.sourceTable ?? "table").split(".").pop()}
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-zinc-700"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span className="font-mono text-emerald-400">
                      {m.targetEntity ?? "Entity"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-600">
                    <span>
                      {m.mappings?.length ?? 1} mapping
                      {(m.mappings?.length ?? 1) === 1 ? "" : "s"}
                    </span>
                    <span>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString()
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mapper Canvas ── */}
      <div className="flex-1 min-h-0 bg-zinc-950/80 border border-zinc-800/80 rounded-xl overflow-hidden relative">
        {/* Dot grid bg */}
        <div className="absolute inset-0 bg-grid-dots opacity-60 pointer-events-none" />
        <div className="relative h-full">
          <VisualSchemaMapper
            key={`${selectedSource}-${selectedOntology}`}
            connectionId={selectedSource}
            sourceTable={sourceData.table}
            sourceColumns={sourceData.columns}
            ontologyProperties={ontologyProps}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
};
