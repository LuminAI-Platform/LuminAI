export interface ChartThemeColors {
  text: string;
  secondaryText: string;
  surface: string;
  border: string;
  splitLine: string;
  palette: string[];
}

export function getChartThemeColors(isDark: boolean): ChartThemeColors {
  return {
    text: isDark ? "#E9EDF4" : "#1A2230",
    secondaryText: isDark ? "#A3ADBF" : "#566176",
    surface: isDark ? "#1A202A" : "#FFFFFF",
    border: isDark ? "#2C3441" : "#DFE3EA",
    splitLine: isDark ? "rgba(163, 173, 191, 0.14)" : "rgba(86, 97, 118, 0.12)",
    palette: isDark
      ? [
          "#60A5FA",
          "#34D399",
          "#A78BFA",
          "#FBBF24",
          "#F472B6",
          "#2DD4BF",
          "#FB923C",
          "#818CF8",
        ]
      : [
          "#2563EB",
          "#059669",
          "#7C3AED",
          "#D97706",
          "#DB2777",
          "#0D9488",
          "#EA580C",
          "#4F46E5",
        ],
  };
}
