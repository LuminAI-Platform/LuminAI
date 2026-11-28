import React, { useMemo } from "react";
import type * as echarts from "echarts";
import { useThemeStore } from "../../stores/themeStore";
import { EChartContainer } from "./EChartContainer";
import { getChartThemeColors } from "./chartTheme";
import type { BarDatum } from "./BarChartCard";

interface PieDonutChartCardProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  height?: number;
  maxSlices?: number;
  emptyMessage?: string;
}

export const PieDonutChartCard: React.FC<PieDonutChartCardProps> = ({
  title,
  subtitle,
  data,
  height = 240,
  maxSlices = 8,
  emptyMessage = "No breakdown data available.",
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  const slices = useMemo(
    () => data.filter((d) => d.value > 0).slice(0, maxSlices),
    [data, maxSlices],
  );

  const option = useMemo<echarts.EChartsOption | null>(() => {
    if (slices.length === 0) return null;
    const theme = getChartThemeColors(isDark);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 12 },
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "vertical",
        right: 8,
        top: "middle",
        textStyle: { color: theme.secondaryText, fontSize: 11 },
        type: "scroll",
      },
      series: [
        {
          type: "pie",
          radius: ["48%", "74%"],
          center: ["36%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: {
            borderColor: theme.surface,
            borderWidth: 2,
          },
          data: slices.map((item, idx) => ({
            name: item.name,
            value: item.value,
            itemStyle: {
              color: item.color || theme.palette[idx % theme.palette.length],
            },
          })),
        },
      ],
    };
  }, [slices, isDark]);

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
        isEmpty={slices.length === 0}
        emptyMessage={emptyMessage}
        ariaLabel={title}
      />
    </div>
  );
};
