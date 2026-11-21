export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) {
    return "–";
  }
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${remM}m`;
}

/**
 * Formats a start timestamp as "Today 15:47" or "Nov 19, 15:47".
 */
export function formatStartTime(
  date: Date | null | undefined,
  now: Date = new Date(),
): string {
  if (!date || Number.isNaN(date.getTime())) return "–";
  const pad = (v: number) => String(v).padStart(2, "0");
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return `Today ${timePart}`;
  }
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${month} ${date.getDate()}, ${timePart}`;
}

export function parseMetadataJson(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function formatOutcomeSummary(ds: {
  syncedRecords?: number;
  totalRecords?: number;
  quarantinedRecords?: number;
  rejectedRecords?: number;
}): string {
  const hasQuarantined =
    typeof ds.quarantinedRecords === "number" && ds.quarantinedRecords > 0;
  const hasRejected =
    typeof ds.rejectedRecords === "number" && ds.rejectedRecords > 0;

  if (hasQuarantined || hasRejected) {
    const parts: string[] = [];
    if (typeof ds.syncedRecords === "number") {
      parts.push(`Loaded ${formatNumber(ds.syncedRecords)}`);
    }
    if (typeof ds.quarantinedRecords === "number") {
      parts.push(`Quarantined ${formatNumber(ds.quarantinedRecords)}`);
    }
    if (typeof ds.rejectedRecords === "number") {
      parts.push(`Rejected ${formatNumber(ds.rejectedRecords)}`);
    }
    return parts.join(" - ");
  }

  if (
    typeof ds.syncedRecords === "number" &&
    typeof ds.totalRecords === "number"
  ) {
    return `${formatNumber(ds.syncedRecords)} / ${formatNumber(ds.totalRecords)} records`;
  }
  if (typeof ds.syncedRecords === "number") {
    return `${formatNumber(ds.syncedRecords)} loaded`;
  }
  return "–";
}
