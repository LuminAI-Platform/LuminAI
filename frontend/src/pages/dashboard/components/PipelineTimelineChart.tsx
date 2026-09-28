import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Skeleton } from "../../../components/ui/Skeleton";

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
 */
export const PipelineTimelineChart: React.FC<PipelineTimelineChartProps> = ({
  data = [],
  isLoading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

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

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#18181b",
        borderColor: "#27272a",
        textStyle: { color: "#f4f4f5", fontSize: 12 },
        axisPointer: {
          type: "cross",
          label: { backgroundColor: "#27272a" },
        },
      },
      legend: {
        data: ["Resolved Entities", "Pipeline Executions"],
        textStyle: { color: "#a1a1aa", fontSize: 11 },
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
        axisLine: { lineStyle: { color: "#27272a" } },
        axisLabel: { color: "#71717a", fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "Entities",
          nameTextStyle: { color: "#71717a", fontSize: 10 },
          axisLabel: { color: "#71717a", fontSize: 10 },
          splitLine: { lineStyle: { color: "#1f1f23", type: "dashed" } },
        },
        {
          type: "value",
          name: "Runs",
          nameTextStyle: { color: "#71717a", fontSize: 10 },
          axisLabel: { color: "#71717a", fontSize: 10 },
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
          itemStyle: { color: "#3b82f6" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
              { offset: 1, color: "rgba(59, 130, 246, 0.0)" },
            ]),
          },
        },
        {
          name: "Pipeline Executions",
          type: "bar",
          yAxisIndex: 1,
          data: runs,
          itemStyle: {
            color: "#10b981",
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 18,
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data, isLoading]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (isLoading) {
    return <Skeleton className="w-full h-64 rounded-xl" />;
  }

  return (
    <div className="relative w-full h-64">
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 pointer-events-none">
          No pipeline telemetry recorded
        </div>
      )}
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
};
