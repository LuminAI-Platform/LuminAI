import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import { EntityBreakdownSingleType } from "./EntityBreakdownSingleType";
import { buildEntityBreakdownOption } from "./entityBreakdownChartOptions";

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
  data,
  isLoading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  const seriesData = useMemo(
    () =>
      Object.entries(data ?? {})
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({
          name,
          value,
          itemStyle: {
            color: getEntityColor(name, isDark),
          },
        })),
    [data, isDark],
  );

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

    if (
      chartInstance.current &&
      chartInstance.current.getDom() !== chartRef.current
    ) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstance.current;
    chart.setOption(buildEntityBreakdownOption(seriesData, isDark), true);

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
    return (
      <EntityBreakdownSingleType
        name={single.name}
        value={single.value}
        color={getEntityColor(single.name, isDark)}
        ariaLabel={ariaLabel}
      />
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
