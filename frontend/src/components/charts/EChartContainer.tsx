import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useThemeStore } from "../../stores/themeStore";
import { Skeleton } from "../ui/Skeleton";

interface EChartContainerProps {
  option: echarts.EChartsOption | null;
  height?: number | string;
  className?: string;
  ariaLabel?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export const EChartContainer: React.FC<EChartContainerProps> = ({
  option,
  height = 240,
  className = "",
  ariaLabel,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No chart data available.",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isLoading || isEmpty || !option) {
      return;
    }

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(el, undefined, {
        renderer: "canvas",
      });
    }
    const chart = instanceRef.current;
    chart.setOption(option, { notMerge: true });

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            chart.resize();
          })
        : null;
    observer?.observe(el);

    return () => {
      observer?.disconnect();
    };
  }, [option, isDark, isLoading, isEmpty]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  if (isLoading) {
    return (
      <Skeleton
        className={`w-full rounded-lg ${className}`}
        style={{ height }}
      />
    );
  }

  if (isEmpty || !option) {
    return (
      <div
        className={`w-full flex items-center justify-center rounded-lg border border-dashed border-border bg-surface-subtle/40 text-xs text-text-secondary ${className}`}
        style={{ height }}
        aria-label={ariaLabel}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={`w-full ${className}`}
      style={{ height }}
    />
  );
};
