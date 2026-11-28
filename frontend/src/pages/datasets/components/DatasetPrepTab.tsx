import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, Play, Plus, Trash2, Wand2 } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import {
  executeCleaningRecipe,
  executeDatasetPipeline,
  fetchDatasets,
  previewCleaningRecipe,
} from "../../../features/datasets/datasetApi";
import type {
  CleaningExecutionResult,
  CleaningStepConfig,
  Dataset,
  PipelineExecutionResult,
} from "../../../features/datasets/types";

interface DatasetPrepTabProps {
  dataset: Dataset;
  schemaEntries: [string, string][];
}

const CLEANING_OPERATIONS = [
  { value: "standardize_text", label: "Standardize Text (Trim / Case)" },
  { value: "fill_missing", label: "Fill Missing Values" },
  { value: "remove_missing", label: "Remove Rows with Nulls" },
  { value: "deduplicate", label: "Deduplicate Rows" },
  { value: "outlier_handling", label: "Outlier Clamping / Handling" },
  { value: "parse_dates", label: "Parse & Normalize Dates" },
  { value: "cast_type", label: "Cast Column Data Type" },
];

const PIPELINE_STEPS = [
  { value: "FILTER", label: "FILTER (Condition)" },
  { value: "SELECT", label: "SELECT (Keep Columns)" },
  { value: "DROP", label: "DROP (Remove Columns)" },
  { value: "RENAME", label: "RENAME (Column Alias)" },
  { value: "DEDUPLICATE", label: "DEDUPLICATE" },
  { value: "SORT", label: "SORT" },
];

export const DatasetPrepTab: React.FC<DatasetPrepTabProps> = ({
  dataset,
  schemaEntries,
}) => {
  const columnNames = schemaEntries.map(([name]) => name);
  const firstCol = columnNames[0] ?? "";

  const [mode, setMode] = useState<"cleaning" | "pipeline">("cleaning");
  const [targetName, setTargetName] = useState<string>(`${dataset.name}_clean`);

  // Cleaning recipe builder state
  const [cleaningSteps, setCleaningSteps] = useState<CleaningStepConfig[]>([
    {
      operation: "standardize_text",
      targetColumns: firstCol ? [firstCol] : [],
      parameters: { trim: true, case: "title" },
    },
  ]);

  // Pipeline transformation state
  const [pipelineName, setPipelineName] = useState<string>(
    `${dataset.name}_curated`,
  );
  const [pipelineSteps, setPipelineSteps] = useState<
    Array<{
      stepId: string;
      stepType: string;
      parameters: Record<string, unknown>;
    }>
  >([
    {
      stepId: "step-1",
      stepType: "DEDUPLICATE",
      parameters: firstCol ? { subset: [firstCol] } : {},
    },
  ]);
  const [secondaryDatasetId, setSecondaryDatasetId] = useState<string>("");

  const { data: allDatasets = [] } = useQuery<Dataset[]>({
    queryKey: ["datasets"],
    queryFn: () => fetchDatasets(),
  });

  const [previewResult, setPreviewResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [cleaningResult, setCleaningResult] =
    useState<CleaningExecutionResult | null>(null);
  const [pipelineResult, setPipelineResult] =
    useState<PipelineExecutionResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: (step: CleaningStepConfig) =>
      previewCleaningRecipe({
        sourceDatasetId: dataset.id,
        datasetId: dataset.id,
        step,
        preview_limit: 25,
      }),
    onSuccess: (data) => setPreviewResult(data),
  });

  const executeCleaningMutation = useMutation({
    mutationFn: () =>
      executeCleaningRecipe({
        sourceDatasetId: dataset.id,
        datasetId: dataset.id,
        datasetName: targetName.trim() || `${dataset.name}_clean`,
        steps: cleaningSteps,
        targetLayer: "WORKING",
      }),
    onSuccess: (data) => setCleaningResult(data),
  });

  const executePipelineMutation = useMutation({
    mutationFn: () =>
      executeDatasetPipeline({
        primaryDatasetId: dataset.id,
        sourceDatasetId: dataset.id,
        datasetName: pipelineName.trim() || `${dataset.name}_curated`,
        secondaryDatasetIds: secondaryDatasetId
          ? { secondary: secondaryDatasetId }
          : undefined,
        steps: pipelineSteps.map((s) => ({
          stepId: s.stepId,
          stepType: s.stepType,
          parameters: s.parameters,
        })),
      }),
    onSuccess: (data) => setPipelineResult(data),
  });

  const activeError =
    previewMutation.error ||
    executeCleaningMutation.error ||
    executePipelineMutation.error;

  const sampleDiffs = Array.isArray(previewResult?.sample_diffs)
    ? (previewResult.sample_diffs as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-xs">
          <button
            onClick={() => setMode("cleaning")}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
              mode === "cleaning"
                ? "bg-primary text-primary-text font-semibold"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Cleaning Recipe (→ WORKING)
          </button>
          <button
            onClick={() => setMode("pipeline")}
            className={`px-3 py-1.5 rounded-md font-medium cursor-pointer transition-colors ${
              mode === "pipeline"
                ? "bg-primary text-primary-text font-semibold"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Transform Pipeline (→ CURATED)
          </button>
        </div>
      </div>

      {activeError && (
        <div className="p-3 rounded-lg border border-error/30 bg-error/10 text-error text-xs">
          {(activeError as Error)?.message || "Execution failed."}
        </div>
      )}

      {mode === "cleaning" ? (
        <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">
                Interactive Cleaning Recipe Builder
              </h3>
              <p className="text-xs text-text-secondary">
                Preview individual step diffs or execute all steps to
                materialize a new WORKING dataset.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Output dataset name"
                className="bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs text-text"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setCleaningSteps((prev) => [
                    ...prev,
                    {
                      operation: "fill_missing",
                      targetColumns: firstCol ? [firstCol] : [],
                      parameters: { strategy: "mode" },
                    },
                  ])
                }
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Step
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={executeCleaningMutation.isPending}
                disabled={cleaningSteps.length === 0}
                onClick={() => executeCleaningMutation.mutate()}
                leftIcon={<Wand2 className="w-3.5 h-3.5" />}
              >
                Run Recipe
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {cleaningSteps.map((step, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-border bg-surface-subtle/50 flex flex-wrap items-center gap-3"
              >
                <span className="text-[11px] font-mono font-bold text-text-secondary w-6">
                  #{idx + 1}
                </span>
                <select
                  value={step.operation}
                  onChange={(e) => {
                    const op = e.target.value;
                    setCleaningSteps((prev) =>
                      prev.map((s, i) =>
                        i === idx
                          ? {
                              ...s,
                              operation: op,
                              parameters:
                                op === "fill_missing"
                                  ? { strategy: "mode" }
                                  : op === "standardize_text"
                                    ? { trim: true, case: "title" }
                                    : op === "outlier_handling"
                                      ? { method: "iqr", action: "cap" }
                                      : {},
                            }
                          : s,
                      ),
                    );
                  }}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text"
                >
                  {CLEANING_OPERATIONS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                <select
                  value={step.targetColumns[0] ?? ""}
                  onChange={(e) => {
                    const col = e.target.value;
                    setCleaningSteps((prev) =>
                      prev.map((s, i) =>
                        i === idx
                          ? { ...s, targetColumns: col ? [col] : [] }
                          : s,
                      ),
                    );
                  }}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text font-mono"
                >
                  <option value="">All / Automatic</option>
                  {columnNames.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={JSON.stringify(step.parameters || {})}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as Record<
                        string,
                        unknown
                      >;
                      setCleaningSteps((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, parameters: parsed } : s,
                        ),
                      );
                    } catch {
                      // allow partial JSON typing cleanly
                    }
                  }}
                  className="flex-1 min-w-[180px] bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text"
                  aria-label="Step parameters JSON"
                />

                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={previewMutation.isPending}
                  onClick={() => previewMutation.mutate(step)}
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                >
                  Preview
                </Button>
                {cleaningSteps.length > 1 && (
                  <button
                    onClick={() =>
                      setCleaningSteps((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                    className="p-1.5 rounded border border-border hover:border-error/40 text-text-secondary hover:text-error cursor-pointer"
                    title="Remove step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {previewResult && (
            <div className="p-4 rounded-lg border border-border bg-surface-subtle/40 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text">
                  Step Preview Diffs ({String(previewResult.affected_rows ?? 0)}{" "}
                  rows affected)
                </span>
                {typeof previewResult.quality_delta_summary === "string" && (
                  <span className="text-text-secondary font-mono">
                    {previewResult.quality_delta_summary}
                  </span>
                )}
              </div>
              {sampleDiffs.length > 0 ? (
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="border-b border-border text-text-secondary">
                      <tr>
                        <th className="py-1.5 px-3">Row</th>
                        <th className="py-1.5 px-3">Column</th>
                        <th className="py-1.5 px-3">Original</th>
                        <th className="py-1.5 px-3">Proposed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sampleDiffs.map((d, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3 text-text-secondary">
                            {String(d.row_index ?? i + 1)}
                          </td>
                          <td className="py-1.5 px-3 text-text">
                            {String(d.column ?? "—")}
                          </td>
                          <td className="py-1.5 px-3 text-error">
                            {String(d.original_value ?? "NULL")}
                          </td>
                          <td className="py-1.5 px-3 text-emerald-400">
                            {String(d.proposed_value ?? "NULL")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-text-secondary">
                  No sample changes detected by this preview step.
                </p>
              )}
            </div>
          )}

          {cleaningResult && (
            <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-emerald-400 block">
                  Created WORKING dataset &quot;
                  {cleaningResult.datasetName ||
                    cleaningResult.dataset_name ||
                    targetName}
                  &quot;
                </span>
                <span className="text-text-secondary font-mono">
                  {cleaningResult.total_output_rows ??
                    cleaningResult.rowsProcessed ??
                    0}{" "}
                  output rows materialized
                </span>
              </div>
              {(cleaningResult.datasetId || cleaningResult.dataset_id) && (
                <Link
                  to="/datasets/$datasetId"
                  params={{
                    datasetId:
                      cleaningResult.datasetId ||
                      cleaningResult.dataset_id ||
                      "",
                  }}
                >
                  <Button variant="primary" size="sm">
                    Open New Dataset
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">
                Transformation Pipeline Builder
              </h3>
              <p className="text-xs text-text-secondary">
                Chain Polars transformations and produce a new CURATED dataset
                linked via persistent lineage.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="Curated dataset name"
                className="bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs text-text"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPipelineSteps((prev) => [
                    ...prev,
                    {
                      stepId: `step-${prev.length + 1}`,
                      stepType: "SELECT",
                      parameters: { columns: columnNames.slice(0, 5) },
                    },
                  ])
                }
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Stage
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={executePipelineMutation.isPending}
                onClick={() => executePipelineMutation.mutate()}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Execute Pipeline
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-secondary">
              Optional Join Secondary Dataset:
            </span>
            <select
              value={secondaryDatasetId}
              onChange={(e) => setSecondaryDatasetId(e.target.value)}
              className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs text-text"
            >
              <option value="">None (Single source)</option>
              {allDatasets
                .filter((d) => d.id !== dataset.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName || d.name} ({d.layer})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            {pipelineSteps.map((step, idx) => (
              <div
                key={step.stepId}
                className="p-3 rounded-lg border border-border bg-surface-subtle/50 flex flex-wrap items-center gap-3"
              >
                <span className="text-[11px] font-mono font-bold text-text-secondary w-6">
                  #{idx + 1}
                </span>
                <select
                  value={step.stepType}
                  onChange={(e) => {
                    const st = e.target.value;
                    setPipelineSteps((prev) =>
                      prev.map((s, i) =>
                        i === idx ? { ...s, stepType: st } : s,
                      ),
                    );
                  }}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text"
                >
                  {PIPELINE_STEPS.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={JSON.stringify(step.parameters || {})}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as Record<
                        string,
                        unknown
                      >;
                      setPipelineSteps((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, parameters: parsed } : s,
                        ),
                      );
                    } catch {
                      // allow typing
                    }
                  }}
                  className="flex-1 min-w-[220px] bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text"
                />
                {pipelineSteps.length > 1 && (
                  <button
                    onClick={() =>
                      setPipelineSteps((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                    className="p-1.5 rounded border border-border hover:border-error/40 text-text-secondary hover:text-error cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {pipelineResult && (
            <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-emerald-400 block">
                  Created CURATED dataset &quot;
                  {pipelineResult.curated_dataset_name || pipelineName}&quot;
                </span>
                <span className="text-text-secondary font-mono">
                  {pipelineResult.total_output_rows ??
                    pipelineResult.recordsTransformed ??
                    0}{" "}
                  output rows materialized
                </span>
              </div>
              {(pipelineResult.datasetId ||
                pipelineResult.dataset_id ||
                pipelineResult.targetDatasetId) && (
                <Link
                  to="/datasets/$datasetId"
                  params={{
                    datasetId:
                      pipelineResult.datasetId ||
                      pipelineResult.dataset_id ||
                      pipelineResult.targetDatasetId ||
                      "",
                  }}
                >
                  <Button variant="primary" size="sm">
                    Open Curated Dataset
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
