import React, { useMemo } from "react";
import type * as echarts from "echarts";
import { useThemeStore } from "../../stores/themeStore";
import { EChartContainer } from "./EChartContainer";
import { getChartThemeColors } from "./chartTheme";

export interface BarDatum {
  name: string;
  value: number;
  color?: string;
}

interface BarChartCardProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  horizontal?: boolean;
  valueSuffix?: string;
  height?: number;
  maxItems?: number;
  emptyMessage?: string;
}

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title,
  subtitle,
  data,
  horizontal = false,
  valueSuffix = "",
  height = 240,
  maxItems = 12,
  emptyMessage = "No categorical distribution available.",
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  const items = useMemo(() => data.slice(0, maxItems), [data, maxItems]);

  const option = useMemo<echarts.EChartsOption | null>(() => {
    if (items.length === 0) return null;
    const theme = getChartThemeColors(isDark);
    const categories = items.map((d) => d.name);
    const values = items.map((d, i) => ({
      value: d.value,
      itemStyle: {
        color: d.color || theme.palette[i % theme.palette.length],
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
        valueFormatter: (val) => `${val}${valueSuffix}`,
      },
      grid: {
        left: horizontal ? 96 : 44,
        right: 16,
        top: 16,
        bottom: horizontal ? 28 : 42,
        containLabel: false,
      },
      xAxis: horizontal
        ? {
            type: "value",
            axisLabel: { color: theme.secondaryText, fontSize: 11 },
            splitLine: { lineStyle: { color: theme.splitLine } },
          }
        : {
            type: "category",
            data: categories,
            axisLabel: {
              color: theme.secondaryText,
              fontSize: 11,
              rotate: categories.length > 6 ? 25 : 0,
              overflow: "truncate",
              width: 72,
            },
            axisLine: { lineStyle: { color: theme.border } },
          },
      yAxis: horizontal
        ? {
            type: "category",
            inverse: true,
            data: categories,
            axisLabel: {
              color: theme.secondaryText,
              fontSize: 11,
              overflow: "truncate",
              width: 84,
            },
            axisLine: { lineStyle: { color: theme.border } },
          }
        : {
            type: "value",
            axisLabel: { color: theme.secondaryText, fontSize: 11 },
            splitLine: { lineStyle: { color: theme.splitLine } },
          },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 28,
        },
      ],
    };
  }, [items, horizontal, valueSuffix, isDark]);

  return (
    <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-text">{title}</h4>
        {subtitle && (
          <span className="text-[11px] text-text-secondary">{subtitle}</span>
        )}
      </div>
      <EChartContainer
        option={option}
        height={height}
        isEmpty={items.length === 0}
        emptyMessage={emptyMessage}
        ariaLabel={title}
      />
    </div>
  );
};
