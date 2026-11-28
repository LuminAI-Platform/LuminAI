import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  ICON_MAP,
  Play,
  Save,
  Database,
  AlertCircle,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import {
  runSqlQuery,
  fetchSavedQueries,
  createSavedQuery,
  fetchDatasets,
} from "../../features/datasets/datasetApi";
import type {
  Dataset,
  SqlQueryResult,
  SavedQuery,
} from "../../features/datasets/types";
import { SaveQueryModal } from "./components/SaveQueryModal";
import { SqlResultsTable } from "./components/SqlResultsTable";
import { SavedQueriesPanel } from "./components/SavedQueriesPanel";

export const SqlStudioPage: React.FC = () => {
  const initialDatasetId =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("datasetId") ?? "")
      : "";

  const [selectedDatasetId, setSelectedDatasetId] =
    useState<string>(initialDatasetId);
  const [queryText, setQueryText] = useState<string>(
    initialDatasetId ? "SELECT * FROM dataset LIMIT 100" : "",
  );
  const [saveQueryName, setSaveQueryName] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);

  const { data: datasets = [] } = useQuery<Dataset[]>({
    queryKey: ["datasets"],
    queryFn: () => fetchDatasets(),
  });

  const { data: savedQueries = [], refetch: refetchSaved } = useQuery<
    SavedQuery[]
  >({
    queryKey: ["saved-queries"],
    queryFn: fetchSavedQueries,
  });

  const sqlMutation = useMutation<SqlQueryResult, Error, string>({
    mutationFn: (sql: string) =>
      runSqlQuery({
        query: sql,
        datasetId: selectedDatasetId || undefined,
        limit: 500,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      sqlText: string;
      datasetId?: string;
    }) => createSavedQuery(payload),
    onSuccess: () => {
      setShowSaveModal(false);
      setSaveQueryName("");
      void refetchSaved();
    },
  });

  const handleRunQuery = () => {
    if (!queryText.trim()) return;
    sqlMutation.mutate(queryText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRunQuery();
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Analytics" }, { label: "SQL Studio" }]}
        title="Interactive SQL Studio"
        description="High-performance analytical SQL query engine powered by DuckDB over versioned datasets and staging records."
        icon={
          <ICON_MAP.nav.sqlAnalytics
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSaveModal(true)}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Query
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunQuery}
              isLoading={sqlMutation.isPending}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Run Query (Ctrl+Enter)
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col shadow-xs">
            <div className="p-3 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  SQL Query Editor (
                  {selectedDatasetId ? "DuckDB Dataset" : "Tenant PostgreSQL"})
                </span>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedDatasetId(nextId);
                    if (nextId && !queryText.trim()) {
                      setQueryText("SELECT * FROM dataset LIMIT 100");
                    }
                  }}
                  aria-label="Target Dataset"
                  className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-text max-w-[220px]"
                >
                  <option value="">Tenant Schema (golden_records)</option>
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.displayName || ds.name} ({ds.layer})
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[11px] text-text-secondary">
                {selectedDatasetId
                  ? "Query table as FROM dataset • Ctrl+Enter to run"
                  : "Press Ctrl+Enter to execute"}
              </span>
            </div>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={9}
              className="w-full p-4 font-mono text-xs bg-surface text-text focus:outline-hidden resize-y leading-relaxed border-none"
              placeholder="Write read-only SELECT query here..."
            />
          </div>

          {sqlMutation.isError && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Execution Error</span>
                <p className="mt-0.5">{sqlMutation.error.message}</p>
              </div>
            </div>
          )}

          <SqlResultsTable queryResult={sqlMutation.data ?? null} />
        </div>

        <SavedQueriesPanel
          savedQueries={savedQueries}
          onSelectQuery={(sql) => setQueryText(sql)}
        />
      </div>

      <SaveQueryModal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          saveMutation.reset();
        }}
        queryName={saveQueryName}
        setQueryName={setSaveQueryName}
        canSave={Boolean(queryText.trim())}
        errorMessage={
          saveMutation.isError
            ? (saveMutation.error as Error)?.message || "Failed to save query"
            : null
        }
        onSave={() =>
          saveMutation.mutate({
            name: saveQueryName,
            sqlText: queryText,
            datasetId: selectedDatasetId || undefined,
          })
        }
        isSaving={saveMutation.isPending}
      />
    </div>
  );
};

export default SqlStudioPage;
