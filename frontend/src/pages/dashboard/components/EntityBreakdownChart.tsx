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
  "#C26E00", // Amber / Warm Orange (high contrast)
  "#56B4E9", // Sky Blue
  "#009E73", // Teal
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
  const isDark = useThemeStore((s) => s.isDark);

  const seriesData = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
    }));

  const total = seriesData.reduce((acc, curr) => acc + curr.value, 0);
  const isEmpty = total === 0 || seriesData.length === 0;

  const ariaLabel = isEmpty
    ? "Entity type distribution: no data."
    : `Entity type distribution: ${total.toLocaleString()} entities indexed across ${seriesData.length} types.`;

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
    const trackColor = isDark ? "#2C3441" : "#DFE3EA";

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      color: palette,
      tooltip: {
        show: !isEmpty,
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
        show: !isEmpty,
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
          radius: isEmpty ? ["68%", "72%"] : ["56%", "76%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: false,
          silent: isEmpty,
          itemStyle: isEmpty
            ? {
                color: trackColor,
                borderWidth: 0,
              }
            : {
                borderRadius: 6,
                borderColor: surfaceColor,
                borderWidth: 2,
              },
          label: {
            show: false,
          },
          emphasis: {
            disabled: isEmpty,
            label: {
              show: !isEmpty,
              fontSize: 12,
              fontWeight: "bold",
              color: textColor,
            },
            scale: !isEmpty,
            scaleSize: 6,
          },
          data: isEmpty ? [{ name: "", value: 1 }] : seriesData,
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
  }, [seriesData, isEmpty, total, isLoading, isDark]);

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
      {/* Center text: a large number with the label "entities indexed" underneath, sized to fit inside hole */}
      <div
        className="absolute pointer-events-none flex flex-col items-center justify-center text-center select-none"
        style={{
          left: "50%",
          top: "44%",
          transform: "translate(-50%, -50%)",
          maxWidth: "85px",
        }}
      >
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-text leading-tight">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] sm:text-xs font-medium text-text-muted mt-0.5 leading-tight text-center">
          entities indexed
        </span>
      </div>

      {/* Empty state: show "No data yet" in the legend area without colored markers */}
      {isEmpty && (
        <div className="absolute bottom-1 inset-x-0 flex justify-center items-center pointer-events-none">
          <span className="text-xs text-text-muted select-none">
            No data yet
          </span>
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
