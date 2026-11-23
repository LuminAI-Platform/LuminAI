import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import { ArrowUpRight, Info } from "../../../lib/icons";

interface EntityBreakdownChartProps {
  data?: Record<string, number>;
  isLoading?: boolean;
}

/**
 * Entity Type Distribution Card Component
 *
 * Rules:
 * - Shows every type returned by the API with counts and percentages.
 * - When multiple types exist: renders an interactive Donut chart using shared theme-calibrated colors.
 * - When only ONE type exists: renders a clean ranked list with a progress bar and an explanatory hint
 *   pointing users to Data Connections and Ontology Manager to map more types.
 * - When zero types exist: renders a clear empty state.
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
      itemStyle: {
        color: getEntityColor(name, isDark),
      },
    }));

  const total = seriesData.reduce((acc, curr) => acc + curr.value, 0);
  const isEmpty = total === 0 || seriesData.length === 0;
  const isSingleType = seriesData.length === 1;

  const ariaLabel = isEmpty
    ? "Entity type distribution: no data."
    : isSingleType
      ? `Entity type distribution: all ${total.toLocaleString()} entities mapped to ${seriesData[0].name} (100%).`
      : `Entity type distribution: ${total.toLocaleString()} entities indexed across ${seriesData.length} types.`;

  useEffect(() => {
    // Only mount echarts when we have 2+ types (donut chart)
    if (!chartRef.current || isLoading || isSingleType || isEmpty) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;
    const textColor = isDark ? "#E9EDF4" : "#1A2230";
    const secondaryColor = isDark ? "#A3ADBF" : "#566176";
    const surfaceColor = isDark ? "#1A202A" : "#FFFFFF";
    const borderColor = isDark ? "#2C3441" : "#DFE3EA";

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        show: true,
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
        show: true,
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
          radius: ["56%", "76%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: false,
          silent: false,
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
          data: seriesData,
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
  }, [seriesData, isSingleType, isEmpty, total, isLoading, isDark]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (isLoading) {
    return <Skeleton className="w-full h-64 rounded-lg" />;
  }

  // Single-type state: show ranked list (not donut) and hint linking to connections & ontology
  if (isSingleType) {
    const single = seriesData[0];
    const color = getEntityColor(single.name, isDark);

    return (
      <div
        className="flex flex-col justify-between h-64 w-full"
        role="region"
        aria-label={ariaLabel}
      >
        {/* Ranked list row */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-bold text-text">{single.name}</span>
            </div>
            <div className="flex items-center gap-1 text-text-secondary">
              <span className="font-bold text-text text-sm">
                {single.value.toLocaleString()}
              </span>
              <span className="text-xs text-text-tertiary">(100%)</span>
            </div>
          </div>

          {/* Full progress ratio bar */}
          <div className="w-full h-2.5 rounded-full bg-surface-subtle overflow-hidden border border-border">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: "100%", backgroundColor: color }}
            />
          </div>
        </div>

        {/* Explanatory hint banner */}
        <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-xs text-text leading-relaxed font-medium">
                Only one entity type found. Map more types during ingestion.
              </p>
              <p className="text-[11px] text-text-secondary leading-normal">
                Columns like physician, insurer, and diagnosis were stored as
                attributes on {single.name}. Configure additional entity types
                to build a rich multi-class graph.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 border-t border-border/60">
            <Link
              to="/connections"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>Data Connections</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            <span className="text-text-tertiary text-xs">·</span>
            <Link
              to="/ontology"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>Ontology Manager</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Multiple types or empty state: Donut chart
  return (
    <div className="relative w-full h-64">
      {/* Center text: a large number with the label "entities indexed" underneath */}
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
