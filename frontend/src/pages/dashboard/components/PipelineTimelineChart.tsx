import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Button } from "../../../components/ui/Button";
import { useThemeStore } from "../../../stores/themeStore";

export interface TimeSeriesPoint {
  date: string;
  entityCount: number;
  pipelineRuns: number;
}

export interface PipelineTimelineChartProps {
  data?: TimeSeriesPoint[];
  isLoading?: boolean;
  timeRange?: "7d" | "14d" | "30d";
}

/**
 * Formats date string into localized 'MMM d' (e.g. 'Nov 11') using the user's locale.
 */
export function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const cleanStr = dateStr.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
    if (parts.length === 2) {
      const currentYear = new Date().getFullYear();
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const date = new Date(currentYear, month, day);
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Dual-axis time-series chart showing pipeline run frequency and entity volumes
 *
 * Rules:
 * - Color-blind-safe palette (Navy + Amber/Orange), avoiding red vs green.
 * - Integer-only ticks on both Y axes with min 0 and max 5 when all values are zero.
 * - Legend placed above the plot area on the left in its own row above axis titles.
 * - Empty state with working button and low-opacity gridlines when zero pipeline runs.
 */
export const PipelineTimelineChart: React.FC<PipelineTimelineChartProps> = ({
  data = [],
  isLoading = false,
  timeRange = "7d",
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  const days = timeRange ? parseInt(timeRange, 10) : data.length || 7;
  const isAllZero =
    data.length === 0 ||
    data.every(
      (d) => (d.entityCount ?? 0) === 0 && (d.pipelineRuns ?? 0) === 0,
    );

  const totalEntities = data.reduce((acc, d) => acc + (d.entityCount ?? 0), 0);
  const totalRuns = data.reduce((acc, d) => acc + (d.pipelineRuns ?? 0), 0);

  const ariaLabel = isAllZero
    ? `Pipeline throughput and entity growth over the last ${days} days: No pipeline runs or resolved entities.`
    : `Pipeline throughput and entity growth over the last ${days} days: ${totalEntities.toLocaleString()} resolved entities and ${totalRuns.toLocaleString()} pipeline runs.`;

  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;

    const dates = data.map((d) => formatDateLabel(d.date));
    const entities = data.map((d) => d.entityCount ?? 0);
    const runs = data.map((d) => d.pipelineRuns ?? 0);

    const maxEntities = Math.max(0, ...entities);
    const maxRuns = Math.max(0, ...runs);

    const textColor = isDark ? "#E9EDF4" : "#1A2230";
    const secondaryColor = isDark ? "#A3ADBF" : "#566176";
    const surfaceColor = isDark ? "#1A202A" : "#FFFFFF";
    const borderColor = isDark ? "#2C3441" : "#DFE3EA";
    const gridLineColor = isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(0, 0, 0, 0.06)";

    // Color-blind safe: Navy + Amber (passing WCAG contrast in both themes)
    const entityLineColor = isDark ? "#6B97FF" : "#12297A";
    const pipelineBarColor = isDark ? "#F2C466" : "#C26E00";

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        show: !isAllZero,
        trigger: "axis",
        backgroundColor: surfaceColor,
        borderColor: borderColor,
        textStyle: { color: textColor, fontSize: 12 },
        axisPointer: {
          type: "cross",
          label: { backgroundColor: surfaceColor, color: textColor },
        },
      },
      legend: {
        show: !isAllZero,
        data: [
          {
            name: "Resolved Entities",
            icon: "roundRect",
            itemStyle: { color: entityLineColor },
          },
          {
            name: "Pipeline Executions",
            icon: "roundRect",
            itemStyle: { color: pipelineBarColor },
          },
        ],
        icon: "roundRect",
        textStyle: { color: secondaryColor, fontSize: 11 },
        top: 0,
        left: 0,
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 16,
      },
      grid: {
        top: 48,
        left: 45,
        right: 45,
        bottom: 25,
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: { color: secondaryColor, fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "Entities",
          nameLocation: "end",
          nameGap: 10,
          nameTextStyle: {
            color: secondaryColor,
            fontSize: 10,
            align: "left",
          },
          axisLabel: {
            color: secondaryColor,
            fontSize: 10,
            formatter: (val: number) => Math.round(val).toString(),
          },
          splitLine: {
            lineStyle: {
              color: gridLineColor,
              type: "dashed",
            },
          },
          min: 0,
          max: maxEntities === 0 ? 5 : undefined,
          minInterval: 1,
        },
        {
          type: "value",
          name: "Runs",
          nameLocation: "end",
          nameGap: 10,
          nameTextStyle: {
            color: secondaryColor,
            fontSize: 10,
            align: "right",
          },
          axisLabel: {
            color: secondaryColor,
            fontSize: 10,
            formatter: (val: number) => Math.round(val).toString(),
          },
          splitLine: { show: false },
          min: 0,
          max: maxRuns === 0 ? 5 : undefined,
          minInterval: 1,
        },
      ],
      series: [
        {
          name: "Resolved Entities",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: isAllZero ? [] : entities,
          lineStyle: { width: 2, color: entityLineColor },
          itemStyle: { color: entityLineColor },
        },
        {
          name: "Pipeline Executions",
          type: "bar",
          yAxisIndex: 1,
          data: isAllZero ? [] : runs,
          itemStyle: {
            color: pipelineBarColor,
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 18,
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [data, isLoading, isDark, isAllZero]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (isLoading) {
    return <Skeleton className="w-full h-64 rounded-lg" />;
  }

  return (
    <div className="relative w-full h-64">
      {isAllZero && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-auto">
          <p className="text-sm font-medium text-text-secondary text-center">
            No pipeline runs in the last {days} days
          </p>
          <Link to="/connections">
            <Button variant="secondary" size="sm">
              Connect a data source
            </Button>
          </Link>
        </div>
      )}
      <div
        ref={chartRef}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-full"
      />
    </div>
  );
};
