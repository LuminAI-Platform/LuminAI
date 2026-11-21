import React from "react";

export function formatCellValue(
  val: unknown,
  colName: string,
): React.ReactNode {
  if (val === null || val === undefined || val === "") {
    return (
      <span className="text-[11px] text-nodata bg-nodata-bg border border-nodata-border px-1.5 py-0.5 rounded italic">
        No data
      </span>
    );
  }

  const colLower = colName.toLowerCase();

  if (
    colLower === "qualitystate" ||
    colLower === "quality_state" ||
    colLower === "recordstate" ||
    colLower === "record_state"
  ) {
    const s = String(val).toUpperCase();
    if (s.includes("VERIFIED")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-bg text-success border border-success-border">
          <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
          VERIFIED
        </span>
      );
    }
    if (s.includes("REVIEW")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning-bg text-warning border border-warning-border">
          <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
          NEEDS REVIEW
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-error-bg text-error border border-error-border">
        <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
        REJECTED
      </span>
    );
  }

  if (
    colLower.includes("confidence") ||
    colLower.includes("score") ||
    colLower.includes("quality")
  ) {
    const numVal =
      typeof val === "number"
        ? Math.round(val <= 1 ? val * 100 : val)
        : parseInt(String(val), 10);

    if (!isNaN(numVal)) {
      const isHigh = numVal >= 90;
      const isMed = numVal >= 75;
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            isHigh
              ? "bg-success-bg text-success border-success-border"
              : isMed
                ? "bg-warning-bg text-warning border-warning-border"
                : "bg-error-bg text-error border-error-border"
          }`}
        >
          {numVal}%
        </span>
      );
    }
  }

  if (
    colLower === "entitytype" ||
    colLower === "entity_type" ||
    colLower === "type"
  ) {
    const typeStr = String(val);
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-subtle text-text border border-border">
        {typeStr}
      </span>
    );
  }

  if (colLower.includes("status")) {
    const s = String(val).toLowerCase();
    let badgeClass =
      "bg-nodata-bg text-nodata border-nodata-border font-medium";
    if (
      s.includes("active") ||
      s.includes("sync") ||
      s.includes("verified") ||
      s.includes("clean") ||
      s.includes("valid") ||
      s.includes("connected")
    ) {
      badgeClass =
        "bg-success-bg text-success border-success-border font-medium";
    } else if (
      s.includes("fail") ||
      s.includes("error") ||
      s.includes("corrupt")
    ) {
      badgeClass = "bg-error-bg text-error border-error-border font-medium";
    } else if (
      s.includes("pend") ||
      s.includes("queue") ||
      s.includes("wait")
    ) {
      badgeClass =
        "bg-warning-bg text-warning border-warning-border font-medium";
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        {String(val)}
      </span>
    );
  }

  if (typeof val === "boolean") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
          val
            ? "bg-success-bg text-success border-success-border"
            : "bg-nodata-bg text-nodata border-nodata-border"
        }`}
      >
        {val ? "True" : "False"}
      </span>
    );
  }

  if (typeof val === "object") {
    return (
      <span className="font-mono text-[11px] text-text-secondary truncate max-w-xs block">
        {JSON.stringify(val)}
      </span>
    );
  }

  return (
    <span className="text-xs text-text truncate max-w-xs block">
      {String(val)}
    </span>
  );
}

export function renderCleanCellValue(
  col: string,
  val: unknown,
): React.ReactNode {
  return formatCellValue(val, col);
}
