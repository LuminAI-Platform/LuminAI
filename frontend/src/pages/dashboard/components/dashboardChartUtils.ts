const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/**
 * Formats date string into consistent 'MMM d' (e.g. 'Nov 11').
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
      return SHORT_DATE_FORMATTER.format(new Date(year, month, day));
    }
    if (parts.length === 2) {
      const currentYear = new Date().getFullYear();
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      return SHORT_DATE_FORMATTER.format(new Date(currentYear, month, day));
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return SHORT_DATE_FORMATTER.format(date);
    }
  } catch {
    // fallback
  }
  return dateStr;
}
