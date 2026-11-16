import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useThemeStore } from "../../../stores/themeStore";

interface EntityBreakdownChartProps {
  data?: Record<string, number>;
  isLoading?: boolean;
}

/**
 * Color-blind-safe 5-color palettes (Okabe-Ito / accessibility calibrated)
 * Rule 7: For charts, use a color-blind-safe set of about five colors,
 * and don't rely on red versus green alone.
 */
const LIGHT_PALETTE = [
  "#12297A", // Luminex Navy
  "#E69F00", // Amber / Orange
  "#56B4E9", // Sky Blue
  "#009E73", // Bluish Green / Teal
  "#CC79A7", // Reddish Purple
];

const DARK_PALETTE = [
  "#6B97FF", // Navy Tint for Dark
  "#F2C466", // Warm Yellow / Gold
  "#56B4E9", // Sky Blue
  "#5FD6A0", // Soft Mint / Teal
  "#CC79A7", // Reddish Purple
];

/**
 * Donut chart rendering entity distribution across ontology classes
 */
export const EntityBreakdownChart: React.FC<EntityBreakdownChartProps> = ({
  data = {},
  isLoading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  const seriesData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  }));

  const total = seriesData.reduce((acc, curr) => acc + curr.value, 0);

  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;
    const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    const textColor = isDark ? "#E9EDF4" : "#1A2230";
    const secondaryColor = isDark ? "#A3ADBF" : "#566176";
    const surfaceColor = isDark ? "#1A202A" : "#FFFFFF";
    const borderColor = isDark ? "#2C3441" : "#DFE3EA";

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      color: palette,
      tooltip: {
        trigger: "item",
        backgroundColor: surfaceColor,
        borderColor: borderColor,
        textStyle: { color: textColor, fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as {
            name: string;
            value: number;
            percent: number;
            color: string;
          };
          return `
            <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; color: ${textColor};">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${p.color};"></span>
              ${p.name}
            </div>
            <div style="color: ${secondaryColor}; font-size: 11px;">
              Count: <span style="color: ${textColor}; font-weight: 600;">${p.value.toLocaleString()}</span> (${p.percent}%)
            </div>
          `;
        },
      },
      legend: {
        orient: "horizontal",
        bottom: 0,
        textStyle: { color: secondaryColor, fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
      },
      series: [
        {
          name: "Entity Breakdown",
          type: "pie",
          radius: ["52%", "74%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: surfaceColor,
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold",
              color: textColor,
            },
            scale: true,
            scaleSize: 6,
          },
          data:
            seriesData.length > 0
              ? seriesData
              : [{ name: "No Data", value: 1 }],
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [seriesData, isLoading, isDark]);

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
      {total === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-text-secondary pointer-events-none">
          No entity records indexed yet
        </div>
      )}
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
};
