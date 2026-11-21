import type * as echarts from "echarts";
import { formatDateLabel } from "./dashboardChartUtils";
import type { TimeSeriesPoint } from "./PipelineTimelineChart";

export function buildPipelineTimelineOption(
  data: TimeSeriesPoint[],
  isDark: boolean,
  isAllZero: boolean,
): echarts.EChartsOption {
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

  return {
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
}
