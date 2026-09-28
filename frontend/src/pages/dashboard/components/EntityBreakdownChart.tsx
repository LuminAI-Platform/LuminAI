import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Skeleton } from "../../../components/ui/Skeleton";

interface EntityBreakdownChartProps {
  data?: Record<string, number>;
  isLoading?: boolean;
}

const PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
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

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      color: PALETTE,
      tooltip: {
        trigger: "item",
        backgroundColor: "#18181b",
        borderColor: "#27272a",
        textStyle: { color: "#f4f4f5", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as {
            name: string;
            value: number;
            percent: number;
            color: string;
          };
          return `
            <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${p.color};"></span>
              ${p.name}
            </div>
            <div style="color: #a1a1aa; font-size: 11px;">
              Count: <span style="color: #f4f4f5; font-weight: 600;">${p.value.toLocaleString()}</span> (${p.percent}%)
            </div>
          `;
        },
      },
      legend: {
        orient: "horizontal",
        bottom: 0,
        textStyle: { color: "#a1a1aa", fontSize: 11 },
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
            borderColor: "#18181b",
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
              color: "#f4f4f5",
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

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [seriesData, isLoading]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (isLoading) {
    return <Skeleton className="w-full h-64 rounded-xl" />;
  }

  return (
    <div className="relative w-full h-64">
      {total === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 pointer-events-none">
          No entity records indexed yet
        </div>
      )}
      <div ref={chartRef} className="w-full h-full" />
    </div>
  );
};
