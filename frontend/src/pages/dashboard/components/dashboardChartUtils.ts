/**
 * Formats date string into localized 'MMM d' (e.g. 'Nov 11') using the user's locale.
 */
export function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const cleanStr = dateStr.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
    if (parts.length === 2) {
      const currentYear = new Date().getFullYear();
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const date = new Date(currentYear, month, day);
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
    }
  } catch {
    // fallback
  }
  return dateStr;
}
