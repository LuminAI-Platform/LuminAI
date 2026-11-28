import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play, Plus, ShieldCheck, Trash2 } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import {
  createQualityRule,
  deleteQualityRule,
  evaluateQualityRules,
  fetchQualityRules,
} from "../../../features/datasets/datasetApi";
import type {
  DataQualityRule,
  QualityRuleEvaluationSummary,
} from "../../../features/datasets/types";

interface DatasetQualityRulesTabProps {
  datasetId: string;
  schemaEntries: [string, string][];
}

export const DatasetQualityRulesTab: React.FC<DatasetQualityRulesTabProps> = ({
  datasetId,
  schemaEntries,
}) => {
  const columns = schemaEntries.map(([name]) => name);
  const [ruleName, setRuleName] = useState("");
  const [dimension, setDimension] = useState("COMPLETENESS");
  const [columnName, setColumnName] = useState(columns[0] ?? "");
  const [ruleType, setRuleType] = useState("NOT_NULL");
  const [paramValue, setParamValue] = useState("");
  const [severity, setSeverity] = useState("ERROR");
  const [lastEval, setLastEval] = useState<QualityRuleEvaluationSummary | null>(
    null,
  );

  const {
    data: rules = [],
    isLoading,
    refetch,
  } = useQuery<DataQualityRule[]>({
    queryKey: ["dataset-rules", datasetId],
    queryFn: () => fetchQualityRules(datasetId),
    enabled: !!datasetId,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parameters: Record<string, unknown> = {};
      if (ruleType === "MIN_VALUE" && paramValue.trim()) {
        parameters.min = Number(paramValue);
      } else if (ruleType === "MAX_VALUE" && paramValue.trim()) {
        parameters.max = Number(paramValue);
      } else if (ruleType === "REGEX" && paramValue.trim()) {
        parameters.pattern = paramValue.trim();
      } else if (ruleType === "ALLOWED_VALUES" && paramValue.trim()) {
        parameters.values = paramValue
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      return createQualityRule(datasetId, {
        ruleName: ruleName.trim() || `${columnName || "dataset"}_${ruleType}`,
        dimension,
        columnName: columnName || undefined,
        ruleType,
        parameters,
        severity,
      });
    },
    onSuccess: () => {
      setRuleName("");
      setParamValue("");
      void refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteQualityRule(datasetId, ruleId),
    onSuccess: () => void refetch(),
  });

  const evaluateMutation = useMutation({
    mutationFn: () => evaluateQualityRules(datasetId),
    onSuccess: (summary) => {
      setLastEval(summary);
      void refetch();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-text">
              Continuous Data Quality Rules
            </h3>
            <p className="text-xs text-text-secondary">
              Define column expectations and validate them live against stored
              dataset records.
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={rules.length === 0}
          isLoading={evaluateMutation.isPending}
          onClick={() => evaluateMutation.mutate()}
          leftIcon={<Play className="w-3.5 h-3.5" />}
        >
          Evaluate All Rules ({rules.length})
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
        className="p-4 rounded-xl border border-border bg-surface grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text-secondary">Rule Name</label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. Email required"
            className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs text-text"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text-secondary">Column</label>
          <select
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs text-text font-mono"
          >
            <option value="">(Select column)</option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text-secondary">Dimension</label>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs text-text"
          >
            {[
              "COMPLETENESS",
              "VALIDITY",
              "UNIQUENESS",
              "CONSISTENCY",
              "ACCURACY",
            ].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text-secondary">Rule Type</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs text-text font-mono"
          >
            {[
              "NOT_NULL",
              "UNIQUE",
              "MIN_VALUE",
              "MAX_VALUE",
              "REGEX",
              "ALLOWED_VALUES",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text-secondary">
            Parameter / Threshold
          </label>
          <input
            type="text"
            value={paramValue}
            onChange={(e) => setParamValue(e.target.value)}
            disabled={ruleType === "NOT_NULL" || ruleType === "UNIQUE"}
            placeholder={
              ruleType === "REGEX"
                ? "^[^@]+@[^@]+$"
                : ruleType === "ALLOWED_VALUES"
                  ? "ACTIVE,PENDING"
                  : ruleType === "MIN_VALUE" || ruleType === "MAX_VALUE"
                    ? "0"
                    : "None needed"
            }
            className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="bg-surface-subtle border border-border rounded-lg px-2 py-1.5 text-xs text-text"
          >
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
          </select>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            isLoading={createMutation.isPending}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add
          </Button>
        </div>
      </form>

      {(createMutation.isError || evaluateMutation.isError) && (
        <div className="p-3 rounded-lg border border-error/30 bg-error/10 text-error text-xs">
          {((createMutation.error || evaluateMutation.error) as Error)
            ?.message || "Quality rule operation failed."}
        </div>
      )}

      {lastEval && (
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">
              Latest Evaluation Run ({lastEval.passedRules}/
              {lastEval.totalRules} rules passed)
            </span>
            <span className="text-text-secondary font-mono">
              {new Date(lastEval.evaluatedAt).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {lastEval.results.map((r) => (
              <div
                key={r.ruleId}
                className="p-3 rounded-lg border border-border bg-surface-subtle/50 flex flex-col gap-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">
                    {r.ruleName}{" "}
                    <span className="font-mono text-text-secondary">
                      ({r.columnName || "*"} • {r.ruleType})
                    </span>
                  </span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded text-[11px] font-semibold ${
                      r.status === "PASSED"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : r.status === "FAILED"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-surface text-text-secondary"
                    }`}
                  >
                    {r.status} • {r.passRate.toFixed(1)}% ({r.failedCount}{" "}
                    failed)
                  </span>
                </div>
                {r.sampleFailures.length > 0 && (
                  <ul className="text-[11px] font-mono text-text-secondary list-disc list-inside">
                    {r.sampleFailures.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-secondary">
            Loading quality rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-secondary">
            No quality rules defined for this dataset yet. Add a rule above to
            monitor completeness, uniqueness, or value ranges.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
              <tr>
                <th className="py-2.5 px-4">Rule</th>
                <th className="py-2.5 px-4">Dimension</th>
                <th className="py-2.5 px-4">Column</th>
                <th className="py-1.5 px-4">Check</th>
                <th className="py-2.5 px-4">Last Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-surface-subtle/40">
                  <td className="py-2.5 px-4 font-semibold text-text">
                    {r.ruleName}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-text-secondary">
                    {r.dimension}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-purple-400">
                    {r.columnName || "*"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-text">
                    {r.ruleType}
                  </td>
                  <td className="py-2.5 px-4">
                    {r.lastStatus ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.lastStatus === "PASSED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {r.lastStatus}
                      </span>
                    ) : (
                      <span className="text-text-secondary">Never run</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(r.id)}
                      className="p-1 text-text-secondary hover:text-error cursor-pointer"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
