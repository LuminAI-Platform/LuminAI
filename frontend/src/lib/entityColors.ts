/**
 * Shared Entity Type Color Palette & Utilities
 *
 * Ensures consistent, color-blind-safe styling across:
 * - Dashboard Entity Type Distribution (Donut & Ranked List)
 * - Knowledge Graph Nodes & Legend
 * - Entity Explorer Filters & Badges
 */

export interface ColorPair {
  light: string;
  dark: string;
}

/**
 * Standard palette for known enterprise & healthcare entity types
 * Calibrated against Okabe-Ito color-blind safe palette + LuminAI Navy
 */
export const ENTITY_TYPE_COLORS: Record<string, ColorPair> = {
  Person: { light: "#12297A", dark: "#6B97FF" }, // Luminex Navy
  Patient: { light: "#12297A", dark: "#6B97FF" }, // Patient
  Physician: { light: "#009E73", dark: "#5FD6A0" }, // Teal / Mint
  Doctor: { light: "#009E73", dark: "#5FD6A0" },
  Organization: { light: "#56B4E9", dark: "#56B4E9" }, // Sky Blue
  Hospital: { light: "#56B4E9", dark: "#56B4E9" },
  Insurer: { light: "#C26E00", dark: "#F2C466" }, // Warm Amber / Gold
  Insurance: { light: "#C26E00", dark: "#F2C466" },
  Department: { light: "#566176", dark: "#A3ADBF" }, // Calm Slate / Neutral
  Diagnosis: { light: "#CC79A7", dark: "#CC79A7" }, // Reddish Purple
  Medication: { light: "#D55E00", dark: "#FF9E66" }, // Vermilion / Coral
  Product: { light: "#CC79A7", dark: "#CC79A7" },
  Dataset: { light: "#C26E00", dark: "#F2C466" },
  Transaction: { light: "#009E73", dark: "#5FD6A0" },
  Location: { light: "#566176", dark: "#A3ADBF" },
};

/** Ordered fallback palette for custom/dynamic entity types */
export const DYNAMIC_PALETTE: ColorPair[] = [
  { light: "#12297A", dark: "#6B97FF" }, // Navy
  { light: "#009E73", dark: "#5FD6A0" }, // Teal
  { light: "#C26E00", dark: "#F2C466" }, // Amber
  { light: "#56B4E9", dark: "#56B4E9" }, // Sky Blue
  { light: "#CC79A7", dark: "#CC79A7" }, // Reddish Purple
  { light: "#D55E00", dark: "#FF9E66" }, // Coral
  { light: "#566176", dark: "#A3ADBF" }, // Slate
];

/**
 * Returns a stable, theme-aware hex color for any entity type name.
 */
export function getEntityColor(
  type: string | undefined | null,
  isDark: boolean,
): string {
  if (!type) {
    return isDark ? "#6B97FF" : "#12297A";
  }

  const clean = type.trim();
  const matched = ENTITY_TYPE_COLORS[clean];
  if (matched) {
    return isDark ? matched.dark : matched.light;
  }

  // Case-insensitive lookup
  const lower = clean.toLowerCase();
  for (const [key, pair] of Object.entries(ENTITY_TYPE_COLORS)) {
    if (key.toLowerCase() === lower) {
      return isDark ? pair.dark : pair.light;
    }
  }

  // Deterministic hash lookup into dynamic palette
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % DYNAMIC_PALETTE.length;
  const picked = DYNAMIC_PALETTE[idx];
  return isDark ? picked.dark : picked.light;
}
