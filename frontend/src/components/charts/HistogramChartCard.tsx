import React, { useMemo } from "react";
import type * as echarts from "echarts";
import { useThemeStore } from "../../stores/themeStore";
import { EChartContainer } from "./EChartContainer";
import { getChartThemeColors } from "./chartTheme";

export interface HistogramBin {
  label: string;
  count: number;
  percentage?: number;
  bin_start?: number;
  bin_end?: number;
}

interface HistogramChartCardProps {
  title: string;
  subtitle?: string;
  bins: HistogramBin[];
  stats?: {
    mean?: number | null;
    median?: number | null;
    min?: number | null;
    max?: number | null;
    std?: number | null;
  };
  height?: number;
  emptyMessage?: string;
}

export const HistogramChartCard: React.FC<HistogramChartCardProps> = ({
  title,
  subtitle,
  bins,
  stats,
  height = 220,
  emptyMessage = "No numeric distribution available.",
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  const option = useMemo<echarts.EChartsOption | null>(() => {
    if (!bins || bins.length === 0) return null;
    const theme = getChartThemeColors(isDark);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
      },
      grid: { left: 42, right: 16, top: 16, bottom: 42 },
      xAxis: {
        type: "category",
        data: bins.map((b) => b.label),
        axisLabel: {
          color: theme.secondaryText,
          fontSize: 10,
          rotate: bins.length > 6 ? 25 : 0,
        },
        axisLine: { lineStyle: { color: theme.border } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: theme.secondaryText, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.splitLine } },
      },
      series: [
        {
          name: "Frequency",
          type: "bar",
          data: bins.map((b) => b.count),
          barCategoryGap: "6%",
          itemStyle: {
            color: theme.palette[0],
            borderRadius: [3, 3, 0, 0],
          },
        },
      ],
    };
  }, [bins, isDark]);

  return (
    <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-text">{title}</h4>
        {subtitle && (
          <span className="text-[11px] text-text-secondary">{subtitle}</span>
        )}
      </div>
      {stats && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-text-secondary">
          {typeof stats.min === "number" && (
            <span>min {stats.min.toLocaleString()}</span>
          )}
          {typeof stats.median === "number" && (
            <span>med {stats.median.toLocaleString()}</span>
          )}
          {typeof stats.mean === "number" && (
            <span>mean {stats.mean.toFixed(2)}</span>
          )}
          {typeof stats.max === "number" && (
            <span>max {stats.max.toLocaleString()}</span>
          )}
        </div>
      )}
      <EChartContainer
        option={option}
        height={height}
        isEmpty={!bins || bins.length === 0}
        emptyMessage={emptyMessage}
        ariaLabel={title}
      />
    </div>
  );
};
