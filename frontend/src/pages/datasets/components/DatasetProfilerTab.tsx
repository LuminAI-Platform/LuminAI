import React, { useMemo, useState } from "react";
import type * as echarts from "echarts";
import { BarChart3, Sparkles } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { BarChartCard } from "../../../components/charts/BarChartCard";
import { PieDonutChartCard } from "../../../components/charts/PieDonutChartCard";
import {
  HistogramChartCard,
  type HistogramBin,
} from "../../../components/charts/HistogramChartCard";
import { EChartContainer } from "../../../components/charts/EChartContainer";
import { getChartThemeColors } from "../../../components/charts/chartTheme";
import { useThemeStore } from "../../../stores/themeStore";
import type { Dataset } from "../../../features/datasets/types";

interface DatasetProfilerTabProps {
  dataset: Dataset;
  schemaEntries: [string, string][];
  onRunEda?: () => void;
  isRunningEda?: boolean;
}

const DIMENSION_KEYS = [
  { key: "completeness", label: "Completeness", color: "text-emerald-400" },
  { key: "validity", label: "Validity", color: "text-emerald-400" },
  { key: "uniqueness", label: "Uniqueness", color: "text-blue-400" },
  { key: "consistency", label: "Consistency", color: "text-purple-400" },
  { key: "accuracy", label: "Accuracy", color: "text-emerald-400" },
] as const;

function readNumericMetric(
  source: Record<string, unknown> | undefined,
  key: string,
): number | null {
  if (!source) return null;
  const direct = source[key];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const nested =
    (source.quality_dimensions as Record<string, unknown> | undefined)?.[key] ??
    (source.dimensions as Record<string, unknown> | undefined)?.[key] ??
    (source.dama as Record<string, unknown> | undefined)?.[key] ??
    (
      (source.quality as Record<string, unknown> | undefined)
        ?.dimension_scores as Record<string, unknown> | undefined
    )?.[key];
  return typeof nested === "number" && Number.isFinite(nested) ? nested : null;
}

function normalizeScorePct(raw: number | null): number | null {
  if (raw === null) return null;
  if (raw > 0 && raw < 1) return raw * 100;
  return raw;
}

function readNum(
  colStats: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  if (!colStats) return null;
  for (const key of keys) {
    const val = colStats[key];
    if (typeof val === "number" && Number.isFinite(val)) return val;
  }
  return null;
}

export const DatasetProfilerTab: React.FC<DatasetProfilerTabProps> = ({
  dataset,
  schemaEntries,
  onRunEda,
  isRunningEda = false,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const summary = dataset.profilingSummary;
  const hasProfiling = Boolean(summary && Object.keys(summary).length > 0);

  const columnProfiles = useMemo(
    () =>
      (summary?.columns ?? summary?.column_profiles ?? {}) as Record<
        string,
        Record<string, unknown>
      >,
    [summary],
  );
  const numericStats = useMemo(
    () =>
      (summary?.numeric_statistics ?? {}) as Record<
        string,
        Record<string, unknown>
      >,
    [summary],
  );
  const categoricalStats = useMemo(
    () =>
      (summary?.categorical_statistics ?? {}) as Record<
        string,
        Record<string, unknown>
      >,
    [summary],
  );
  const missingness = useMemo(
    () => (summary?.missingness ?? {}) as Record<string, unknown>,
    [summary],
  );
  const correlation = useMemo(
    () => (summary?.correlation_matrix ?? {}) as Record<string, unknown>,
    [summary],
  );

  const numericCols = useMemo(
    () =>
      Object.keys(numericStats).filter((c) => {
        const hist = numericStats[c]?.histogram ?? columnProfiles[c]?.histogram;
        return Array.isArray(hist) && hist.length > 0;
      }),
    [numericStats, columnProfiles],
  );

  const categoricalCols = useMemo(
    () =>
      Object.keys(categoricalStats).filter((c) => {
        const cats =
          categoricalStats[c]?.top_categories ??
          columnProfiles[c]?.most_frequent_values;
        return Array.isArray(cats) && cats.length > 0;
      }),
    [categoricalStats, columnProfiles],
  );

  const [selectedNumCol, setSelectedNumCol] = useState<string>("");
  const [selectedCatCol, setSelectedCatCol] = useState<string>("");
  const [catChartType, setCatChartType] = useState<"bar" | "pie">("bar");

  const activeNumCol =
    selectedNumCol && numericCols.includes(selectedNumCol)
      ? selectedNumCol
      : (numericCols[0] ?? "");
  const activeCatCol =
    selectedCatCol && categoricalCols.includes(selectedCatCol)
      ? selectedCatCol
      : (categoricalCols[0] ?? "");

  const missingnessBars = useMemo(() => {
    const perCol = missingness.per_column as
      | Record<string, { missing_pct?: number }>
      | undefined;
    if (perCol) {
      return Object.entries(perCol)
        .filter(([, v]) => (v?.missing_pct ?? 0) > 0)
        .map(([col, v]) => ({
          name: col,
          value: Number((v.missing_pct ?? 0).toFixed(1)),
        }))
        .sort((a, b) => b.value - a.value);
    }
    return Object.entries(columnProfiles)
      .map(([col, prof]) => ({
        name: col,
        value:
          readNum(prof, "null_percentage", "nullPercentage", "null_pct") ?? 0,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [missingness, columnProfiles]);

  const activeHistogramBins = useMemo<HistogramBin[]>(() => {
    if (!activeNumCol) return [];
    const raw =
      numericStats[activeNumCol]?.histogram ??
      columnProfiles[activeNumCol]?.histogram;
    return Array.isArray(raw) ? (raw as HistogramBin[]) : [];
  }, [activeNumCol, numericStats, columnProfiles]);

  const activeCatData = useMemo(() => {
    if (!activeCatCol) return [];
    const raw =
      categoricalStats[activeCatCol]?.top_categories ??
      columnProfiles[activeCatCol]?.most_frequent_values;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        const rec = entry as Record<string, unknown>;
        return {
          name: String(rec.value ?? rec.name ?? "Unknown"),
          value: Number(rec.count ?? rec.value_count ?? 0),
        };
      })
      .filter((d) => d.value > 0);
  }, [activeCatCol, categoricalStats, columnProfiles]);

  const corrHeatmapOption = useMemo<echarts.EChartsOption | null>(() => {
    const cols = Array.isArray(correlation.columns)
      ? (correlation.columns as string[])
      : [];
    const matrix = Array.isArray(correlation.matrix)
      ? (correlation.matrix as number[][])
      : [];
    if (cols.length < 2 || matrix.length === 0) return null;
    const theme = getChartThemeColors(isDark);
    const points: [number, number, number][] = [];
    for (let i = 0; i < cols.length; i++) {
      for (let j = 0; j < cols.length; j++) {
        const val = matrix[i]?.[j] ?? 0;
        points.push([j, i, Number(val.toFixed(2))]);
      }
    }
    return {
      backgroundColor: "transparent",
      tooltip: {
        position: "top",
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number] };
          return `${cols[p.value[1]]} × ${cols[p.value[0]]}: ${p.value[2]}`;
        },
      },
      grid: { left: 86, right: 20, top: 12, bottom: 52 },
      xAxis: {
        type: "category",
        data: cols,
        axisLabel: { color: theme.secondaryText, fontSize: 10, rotate: 25 },
      },
      yAxis: {
        type: "category",
        data: cols,
        axisLabel: { color: theme.secondaryText, fontSize: 10 },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 90,
        textStyle: { color: theme.secondaryText, fontSize: 10 },
        inRange: { color: ["#EF4444", "#F8FAFC", "#2563EB"] },
      },
      series: [
        {
          type: "heatmap",
          data: points,
          label: { show: cols.length <= 6, fontSize: 10 },
        },
      ],
    };
  }, [correlation, isDark]);

  const tableRows = useMemo(() => {
    if (schemaEntries.length > 0) return schemaEntries;
    return Object.entries(columnProfiles).map(
      ([col, prof]) =>
        [
          col,
          typeof prof?.inferred_type === "string"
            ? prof.inferred_type
            : "string",
        ] as [string, string],
    );
  }, [schemaEntries, columnProfiles]);

  return (
    <div className="flex flex-col gap-4">
      {!hasProfiling && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-text">
                Dataset not profiled yet
              </p>
              <p className="text-[11px] text-text-secondary">
                Run automated EDA profiling to compute DAMA quality scores,
                distributions, histograms, and anomaly detection.
              </p>
            </div>
          </div>
          {onRunEda && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRunEda}
              isLoading={isRunningEda}
              leftIcon={<BarChart3 className="w-3.5 h-3.5" />}
            >
              Run EDA Profile
            </Button>
          )}
        </div>
      )}

      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">
            DAMA Data Quality Dimensions
          </h3>
          {typeof dataset.qualityScore === "number" && (
            <span className="text-xs font-mono font-semibold text-primary">
              Overall Score: {dataset.qualityScore.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {DIMENSION_KEYS.map((dim) => {
            const pct = normalizeScorePct(readNumericMetric(summary, dim.key));
            return (
              <div
                key={dim.label}
                className="p-3 rounded-lg bg-surface-subtle border border-border"
              >
                <span className="text-[11px] text-text-secondary block">
                  {dim.label}
                </span>
                <span
                  className={`text-base font-bold ${pct !== null ? dim.color : "text-text-secondary"}`}
                >
                  {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {hasProfiling && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            {numericCols.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-text-secondary">
                  Numeric Histogram:
                </span>
                {numericCols.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSelectedNumCol(col)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                      activeNumCol === col
                        ? "bg-primary text-primary-text font-semibold"
                        : "bg-surface-subtle text-text-secondary hover:text-text border border-border"
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            )}
            <HistogramChartCard
              title={
                activeNumCol
                  ? `Distribution: ${activeNumCol}`
                  : "Numeric Distribution"
              }
              subtitle={activeNumCol ? "Binned value histogram" : undefined}
              bins={activeHistogramBins}
              stats={
                activeNumCol
                  ? {
                      min: readNum(numericStats[activeNumCol], "min"),
                      median: readNum(numericStats[activeNumCol], "median"),
                      mean: readNum(numericStats[activeNumCol], "mean"),
                      max: readNum(numericStats[activeNumCol], "max"),
                    }
                  : undefined
              }
              emptyMessage="No numeric columns with histogram bins detected."
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {categoricalCols.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSelectedCatCol(col)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                      activeCatCol === col
                        ? "bg-primary text-primary-text font-semibold"
                        : "bg-surface-subtle text-text-secondary hover:text-text border border-border"
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
              {categoricalCols.length > 0 && (
                <div className="inline-flex rounded border border-border overflow-hidden text-[11px]">
                  <button
                    onClick={() => setCatChartType("bar")}
                    className={`px-2 py-0.5 cursor-pointer ${catChartType === "bar" ? "bg-primary text-primary-text font-semibold" : "bg-surface text-text-secondary"}`}
                  >
                    Bar
                  </button>
                  <button
                    onClick={() => setCatChartType("pie")}
                    className={`px-2 py-0.5 cursor-pointer ${catChartType === "pie" ? "bg-primary text-primary-text font-semibold" : "bg-surface text-text-secondary"}`}
                  >
                    Donut
                  </button>
                </div>
              )}
            </div>
            {catChartType === "pie" ? (
              <PieDonutChartCard
                title={
                  activeCatCol
                    ? `Breakdown: ${activeCatCol}`
                    : "Categorical Breakdown"
                }
                subtitle="Top categories share"
                data={activeCatData}
                emptyMessage="No categorical distribution available."
              />
            ) : (
              <BarChartCard
                title={
                  activeCatCol
                    ? `Top Categories: ${activeCatCol}`
                    : "Categorical Breakdown"
                }
                subtitle="Record count"
                data={activeCatData}
                horizontal={true}
                emptyMessage="No categorical distribution available."
              />
            )}
          </div>

          {missingnessBars.length > 0 && (
            <BarChartCard
              title="Missing Values by Column (%)"
              subtitle={`${missingnessBars.length} columns with nulls`}
              data={missingnessBars}
              horizontal={true}
              valueSuffix="%"
              height={220}
            />
          )}

          {corrHeatmapOption && (
            <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-text">
                Numeric Correlation Matrix
              </h4>
              <EChartContainer
                option={corrHeatmapOption}
                height={220}
                ariaLabel="Numeric Correlation Matrix"
              />
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text">
            Inferred Column Profile Statistics
          </h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
            <tr>
              <th className="py-2.5 px-4">Column Name</th>
              <th className="py-2.5 px-4">Inferred Type</th>
              <th className="py-2.5 px-4">Null %</th>
              <th className="py-2.5 px-4">Distinct Values</th>
              <th className="py-2.5 px-4">Outliers</th>
              <th className="py-2.5 px-4">Quality Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tableRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-text-secondary"
                >
                  No schema columns inferred yet. Run EDA Profile to inspect
                  column statistics.
                </td>
              </tr>
            ) : (
              tableRows.map(([col, type]) => {
                const colStats = columnProfiles[col];
                const nullPct = readNum(
                  colStats,
                  "null_percentage",
                  "nullPercentage",
                  "null_pct",
                );
                const distinctCount = readNum(
                  colStats,
                  "distinct_count",
                  "distinctCount",
                  "unique_count",
                );
                const outlierCount = readNum(
                  colStats,
                  "outlier_count",
                  "outlierCount",
                );
                const rawHealth = colStats?.health;
                const numericHealth =
                  typeof rawHealth === "number" && Number.isFinite(rawHealth)
                    ? rawHealth
                    : null;
                const stringHealth =
                  typeof rawHealth === "string" ? rawHealth : null;
                const healthColor =
                  numericHealth !== null
                    ? numericHealth >= 90
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : numericHealth >= 70
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                return (
                  <tr key={col} className="hover:bg-surface-subtle/40">
                    <td className="py-2.5 px-4 font-mono font-medium text-text">
                      {col}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-purple-400">
                      {type}
                    </td>
                    <td className="py-2.5 px-4 text-text">
                      {nullPct !== null ? `${nullPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-text-secondary">
                      {distinctCount !== null
                        ? distinctCount.toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-text-secondary">
                      {outlierCount !== null
                        ? outlierCount.toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      {numericHealth !== null ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${healthColor}`}
                        >
                          {numericHealth.toFixed(1)}%
                        </span>
                      ) : stringHealth ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${healthColor}`}
                        >
                          {stringHealth}
                        </span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
