import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Button } from "../../../components/ui/Button";
import { useThemeStore } from "../../../stores/themeStore";
import { buildPipelineTimelineOption } from "./pipelineTimelineChartOptions";

export interface TimeSeriesPoint {
  date: string;
  entityCount: number;
  pipelineRuns: number;
}

export interface PipelineTimelineChartProps {
  data?: TimeSeriesPoint[];
  isLoading?: boolean;
  timeRange?: "7d" | "14d" | "30d";
}

/**
 * Dual-axis time-series chart showing pipeline run frequency and entity volumes
 *
 * Rules:
 * - Color-blind-safe palette (Navy + Amber/Orange), avoiding red vs green.
 * - Integer-only ticks on both Y axes with min 0 and max 5 when all values are zero.
 * - Legend placed above the plot area on the left in its own row above axis titles.
 * - Empty state with working button and low-opacity gridlines when zero pipeline runs.
 */
export const PipelineTimelineChart: React.FC<PipelineTimelineChartProps> = ({
  data = [],
  isLoading = false,
  timeRange = "7d",
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  const days = timeRange ? parseInt(timeRange, 10) : data.length || 7;
  const isAllZero =
    data.length === 0 ||
    data.every(
      (d) => (d.entityCount ?? 0) === 0 && (d.pipelineRuns ?? 0) === 0,
    );

  const totalEntities = data.reduce((acc, d) => acc + (d.entityCount ?? 0), 0);
  const totalRuns = data.reduce((acc, d) => acc + (d.pipelineRuns ?? 0), 0);

  const ariaLabel = isAllZero
    ? `Pipeline throughput and entity growth over the last ${days} days: No pipeline runs or resolved entities.`
    : `Pipeline throughput and entity growth over the last ${days} days: ${totalEntities.toLocaleString()} resolved entities and ${totalRuns.toLocaleString()} pipeline runs.`;

  useEffect(() => {
    if (!chartRef.current || isLoading) return;

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
    chart.setOption(buildPipelineTimelineOption(data, isDark, isAllZero), true);

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

  if (isLoading) {
    return <Skeleton className="w-full h-64 rounded-lg" />;
  }

  return (
    <div className="relative w-full h-64">
      {isAllZero && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-auto">
          <p className="text-sm font-medium text-text-secondary text-center">
            No pipeline runs in the last {days} days
          </p>
          <Link to="/connections">
            <Button variant="secondary" size="sm">
              Connect a data source
            </Button>
          </Link>
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
