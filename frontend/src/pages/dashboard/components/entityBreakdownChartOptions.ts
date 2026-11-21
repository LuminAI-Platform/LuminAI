import type * as echarts from "echarts";

export interface EntityBreakdownSeriesItem {
  name: string;
  value: number;
  itemStyle: {
    color: string;
  };
}

export function buildEntityBreakdownOption(
  seriesData: EntityBreakdownSeriesItem[],
  isDark: boolean,
): echarts.EChartsOption {
  const textColor = isDark ? "#E9EDF4" : "#1A2230";
  const secondaryColor = isDark ? "#A3ADBF" : "#566176";
  const surfaceColor = isDark ? "#1A202A" : "#FFFFFF";
  const borderColor = isDark ? "#2C3441" : "#DFE3EA";

  return {
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
}
