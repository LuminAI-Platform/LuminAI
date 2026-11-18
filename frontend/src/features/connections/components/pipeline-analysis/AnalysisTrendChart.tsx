import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useThemeStore } from "../../../../stores/themeStore";
import { formatDateLabel } from "./pipelineAnalysisUtils";
import type { TimeSeriesPoint } from "./pipelineAnalysisTypes";

interface AnalysisTrendChartProps {
  data?: TimeSeriesPoint[];
  isLoading?: boolean;
}

export const AnalysisTrendChart: React.FC<AnalysisTrendChartProps> = ({
  data = [],
  isLoading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  const isAllZero =
    data.length === 0 ||
    data.every(
      (d) => (d.entityCount ?? 0) === 0 && (d.pipelineRuns ?? 0) === 0,
    );

  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;
    const dates = data.map((d) => formatDateLabel(d.date));
    const entityCounts = data.map((d) => d.entityCount ?? 0);
    const pipelineRuns = data.map((d) => d.pipelineRuns ?? 0);

    const textColor = isDark ? "#E9EDF4" : "#1A2230";
    const secondaryColor = isDark ? "#A3ADBF" : "#566176";
    const surfaceColor = isDark ? "#1A202A" : "#FFFFFF";
    const borderColor = isDark ? "#2C3441" : "#DFE3EA";
    const gridLineColor = isDark
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(0, 0, 0, 0.06)";

    // Theme palette
    const throughputColor = isDark ? "#6B97FF" : "#12297A";
    const runsColor = isDark ? "#F2C466" : "#C26E00";

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
            name: "Records Throughput",
            icon: "roundRect",
            itemStyle: { color: throughputColor },
          },
          {
            name: "Pipeline Runs",
            icon: "roundRect",
            itemStyle: { color: runsColor },
          },
        ],
        textStyle: { color: secondaryColor, fontSize: 11 },
        top: 0,
        left: 0,
        itemWidth: 12,
        itemHeight: 8,
        itemGap: 16,
      },
      grid: {
        top: 44,
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
          name: "Records",
          nameLocation: "end",
          nameGap: 10,
          nameTextStyle: { color: secondaryColor, fontSize: 10, align: "left" },
          axisLabel: {
            color: secondaryColor,
            fontSize: 10,
            formatter: (val: number) => Math.round(val).toString(),
          },
          splitLine: {
            lineStyle: { color: gridLineColor, type: "dashed" },
          },
          min: 0,
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
          minInterval: 1,
        },
      ],
      series: [
        {
          name: "Records Throughput",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: isDark
                  ? "rgba(107, 151, 255, 0.3)"
                  : "rgba(18, 41, 122, 0.2)",
              },
              {
                offset: 1,
                color: isDark
                  ? "rgba(107, 151, 255, 0.0)"
                  : "rgba(18, 41, 122, 0.0)",
              },
            ]),
          },
          data: isAllZero ? [] : entityCounts,
          lineStyle: { width: 2, color: throughputColor },
          itemStyle: { color: throughputColor },
        },
        {
          name: "Pipeline Runs",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: isAllZero ? [] : pipelineRuns,
          lineStyle: { width: 2, color: runsColor },
          itemStyle: { color: runsColor },
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

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs transition-colors select-none">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-text">
            Throughput & Execution Trend
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Historical processed volume and execution counts over time
          </p>
        </div>
      </div>

      <div className="relative w-full h-64">
        {isAllZero && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 pointer-events-none">
            <span className="text-sm font-semibold text-text">
              No time-series data yet
            </span>
            <p className="text-xs text-text-secondary max-w-sm text-center">
              Historical throughput and run frequency will chart automatically
              once pipelines execute.
            </p>
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" />
      </div>
    </div>
  );
};
