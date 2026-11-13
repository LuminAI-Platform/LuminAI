import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useThemeStore } from "../../../stores/themeStore";

export interface TimeSeriesPoint {
  date: string;
  entityCount: number;
  pipelineRuns: number;
}

interface PipelineTimelineChartProps {
  data?: TimeSeriesPoint[];
  isLoading?: boolean;
}

/**
 * Dual-axis time-series chart showing pipeline run frequency and entity volumes
 *
 * Rules:
 * - Color-blind-safe palette (Navy + Amber/Orange), avoiding red vs green.
 * - No gradient washes or neon glows: clean solid lines and bars.
 */
export const PipelineTimelineChart: React.FC<PipelineTimelineChartProps> = ({
  data = [],
  isLoading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;

    const dates = data.map((d) => d.date.slice(5)); // 'MM-DD'
    const entities = data.map((d) => d.entityCount);
    const runs = data.map((d) => d.pipelineRuns);

    const textColor = isDark ? "#E9EDF4" : "#1A2230";
    const secondaryColor = isDark ? "#A3ADBF" : "#566176";
    const surfaceColor = isDark ? "#1A202A" : "#FFFFFF";
    const borderColor = isDark ? "#2C3441" : "#DFE3EA";
    const gridLineColor = isDark ? "#222A37" : "#F0F2F5";

    // Color-blind safe: Navy + Amber
    const entityLineColor = isDark ? "#6B97FF" : "#12297A";
    const pipelineBarColor = isDark ? "#F2C466" : "#E69F00";

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
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
        data: ["Resolved Entities", "Pipeline Executions"],
        textStyle: { color: secondaryColor, fontSize: 11 },
        top: 0,
        right: 10,
        itemWidth: 12,
        itemHeight: 8,
      },
      grid: {
        top: 36,
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
          nameTextStyle: { color: secondaryColor, fontSize: 10 },
          axisLabel: { color: secondaryColor, fontSize: 10 },
          splitLine: { lineStyle: { color: gridLineColor, type: "dashed" } },
        },
        {
          type: "value",
          name: "Runs",
          nameTextStyle: { color: secondaryColor, fontSize: 10 },
          axisLabel: { color: secondaryColor, fontSize: 10 },
          splitLine: { show: false },
          minInterval: 1,
        },
      ],
      series: [
        {
          name: "Resolved Entities",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: entities,
          lineStyle: { width: 2, color: entityLineColor },
          itemStyle: { color: entityLineColor },
          // Removed gradient wash per Rule 4
        },
        {
          name: "Pipeline Executions",
          type: "bar",
          yAxisIndex: 1,
          data: runs,
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

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data, isLoading, isDark]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (isLoading) {
    return <Skeleton className="w-full h-64 rounded-lg" />;
  }

  return <div ref={chartRef} className="w-full h-64" />;
};
