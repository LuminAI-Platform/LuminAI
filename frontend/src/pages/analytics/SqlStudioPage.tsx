import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  Table,
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
} from "../../features/datasets/datasetApi";
import type { SqlQueryResult, SavedQuery } from "../../features/datasets/types";
import { SqlResultsTable } from "./components/SqlResultsTable";
import { SqlSidePanel } from "./components/SqlSidePanel";
import { SaveQueryModal } from "./components/SaveQueryModal";

const SAMPLE_QUERY = `-- Analytical query over in-memory datasets
SELECT 
    tier, 
    COUNT(*) AS total_customers,
    ROUND(AVG(score), 2) AS avg_engagement_score
FROM (
    VALUES 
        ('Enterprise', 94.5),
        ('Enterprise', 88.0),
        ('Mid-Market', 76.5),
        ('SMB', 62.0),
        ('Enterprise', 91.2)
) AS customers(tier, score)
GROUP BY tier
ORDER BY avg_engagement_score DESC;`;

export const SqlStudioPage: React.FC = () => {
  const [queryText, setQueryText] = useState<string>(SAMPLE_QUERY);
  const [saveQueryName, setSaveQueryName] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);

  const { data: savedQueries = [], refetch: refetchSaved } = useQuery<
    SavedQuery[]
  >({
    queryKey: ["saved-queries"],
    queryFn: fetchSavedQueries,
  });

  const sqlMutation = useMutation<SqlQueryResult, Error, string>({
    mutationFn: (sql: string) => runSqlQuery({ query: sql, limit: 500 }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; sqlText: string }) =>
      createSavedQuery(payload),
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

  const queryResult = sqlMutation.data;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Analytics" }, { label: "SQL Studio" }]}
        title="Interactive SQL Studio"
        description="High-performance analytical SQL query engine powered by DuckDB over versioned datasets and staging records."
        icon={
          <Table size={ICON_SIZES.header} className="text-text-secondary" />
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

      {/* Editor & Side Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SQL Editor Area */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col shadow-xs">
            <div className="p-3 bg-surface-subtle border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-text flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-primary" />
                SQL Query Editor (DuckDB Dialect)
              </span>
              <span className="text-[11px] text-text-secondary">
                Press Ctrl+Enter to execute
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

          {queryResult && <SqlResultsTable queryResult={queryResult} />}
        </div>

        <SqlSidePanel
          savedQueries={savedQueries}
          onSelectQuery={setQueryText}
        />
      </div>

      {showSaveModal && (
        <SaveQueryModal
          queryName={saveQueryName}
          onQueryNameChange={setSaveQueryName}
          isSaving={saveMutation.isPending}
          onCancel={() => setShowSaveModal(false)}
          onSave={() =>
            saveMutation.mutate({
              name: saveQueryName,
              sqlText: queryText,
            })
          }
        />
      )}
    </div>
  );
};

export default SqlStudioPage;
