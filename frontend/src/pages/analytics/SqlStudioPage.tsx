import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  Table,
  Play,
  Save,
  Clock,
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

          {/* Error Message */}
          {sqlMutation.isError && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Execution Error</span>
                <p className="mt-0.5">{sqlMutation.error.message}</p>
              </div>
            </div>
          )}

          {/* Results Table */}
          {queryResult && (
            <div className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
              <div className="p-3 bg-surface-subtle border-b border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-text">Results</span>
                  <span className="text-text-secondary">
                    {queryResult.rowCount} rows of {queryResult.totalCount}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{queryResult.executionTimeMs} ms</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-subtle/80 sticky top-0 border-b border-border text-text-secondary font-semibold">
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th key={col.name} className="py-2.5 px-4 font-mono">
                          {col.name}
                          <span className="block text-[10px] font-normal text-text-secondary">
                            {col.dataType || col.data_type || "VARCHAR"}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-subtle/40">
                        {queryResult.columns.map((col) => (
                          <td key={col.name} className="py-2 px-4 text-text">
                            {String(row[col.name] ?? "NULL")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel: Saved Queries & Templates */}
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Saved Queries ({savedQueries.length})
            </h3>
            {savedQueries.length === 0 ? (
              <span className="text-xs text-text-secondary">
                No queries saved yet.
              </span>
            ) : (
              <div className="flex flex-col gap-2">
                {savedQueries.map((sq) => (
                  <button
                    key={sq.id}
                    onClick={() => setQueryText(sq.sqlText)}
                    className="p-2.5 rounded-lg border border-border bg-surface-subtle hover:border-primary text-left text-xs transition-colors cursor-pointer"
                  >
                    <span className="font-semibold text-text block">
                      {sq.name}
                    </span>
                    <span className="text-[11px] text-text-secondary truncate block font-mono mt-0.5">
                      {sq.sqlText}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Query Templates
            </h3>
            <button
              onClick={() =>
                setQueryText(
                  "SELECT * FROM customers WHERE tier = 'Enterprise' LIMIT 50;",
                )
              }
              className="text-left text-xs text-primary hover:underline"
            >
              • Filter by Customer Tier
            </button>
            <button
              onClick={() =>
                setQueryText(
                  "SELECT entity_type, COUNT(*) AS count FROM golden_records GROUP BY entity_type;",
                )
              }
              className="text-left text-xs text-primary hover:underline"
            >
              • Golden Records Entity Breakdown
            </button>
          </div>
        </div>
      </div>

      {/* Save Query Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-base font-bold text-text">Save SQL Query</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-secondary">
                Query Name
              </label>
              <input
                type="text"
                value={saveQueryName}
                onChange={(e) => setSaveQueryName(e.target.value)}
                placeholder="e.g. Monthly Revenue by Tier"
                className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!saveQueryName.trim()}
                isLoading={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({
                    name: saveQueryName,
                    sqlText: queryText,
                  })
                }
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlStudioPage;
