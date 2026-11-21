import type { SearchResultItem } from "../../../pages/explorer/types";
import { formatPropertyLabel } from "../../../pages/explorer/utils";
import type { ColumnDef } from "./EntityTableRow";

export type TableSortDir = "asc" | "desc";

const SKIP_PROPERTY_KEYS = new Set([
  "canonical_name",
  "canonicalname",
  "entity_type",
  "entitytype",
  "id",
  "uuid",
]);

export function getTopPropertyKeys(entities: SearchResultItem[]): string[] {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    for (const [k, v] of Object.entries(entity.properties || {})) {
      if (
        !SKIP_PROPERTY_KEYS.has(k.toLowerCase()) &&
        v !== null &&
        v !== undefined &&
        String(v).trim() !== ""
      ) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([k]) => k);
}

export function buildEntityTableColumns(
  hasConfidence: boolean,
  hasSources: boolean,
  topPropertyKeys: string[],
): ColumnDef[] {
  const cols: ColumnDef[] = [
    { id: "canonicalName", label: "Name", sortable: true },
    { id: "entityType", label: "Type", sortable: true },
  ];
  if (hasConfidence) {
    cols.push({ id: "confidenceScore", label: "Confidence", sortable: true });
  }
  if (hasSources) {
    cols.push({ id: "sourceCount", label: "Sources", sortable: true });
  }
  for (const propKey of topPropertyKeys) {
    cols.push({
      id: `prop:${propKey}`,
      label: formatPropertyLabel(propKey),
      sortable: true,
      isProperty: true,
    });
  }
  cols.push({ id: "updatedAt", label: "Updated", sortable: true });
  return cols;
}

export function sortTableEntities(
  entities: SearchResultItem[],
  sortCol: string | null,
  sortDir: TableSortDir,
): SearchResultItem[] {
  if (!sortCol) return entities;
  const copy = [...entities];
  copy.sort((a, b) => {
    let cmp = 0;
    if (sortCol === "canonicalName") {
      cmp = a.canonicalName.localeCompare(b.canonicalName);
    } else if (sortCol === "entityType") {
      cmp = a.entityType.localeCompare(b.entityType);
    } else if (sortCol === "confidenceScore") {
      cmp = (a.confidenceScore ?? -1) - (b.confidenceScore ?? -1);
    } else if (sortCol === "sourceCount") {
      cmp = (a.sourceCount ?? 0) - (b.sourceCount ?? 0);
    } else if (sortCol === "updatedAt") {
      const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      cmp = aTime - bTime;
    } else if (sortCol.startsWith("prop:")) {
      const key = sortCol.slice(5);
      const av = String(a.properties?.[key] ?? "");
      const bv = String(b.properties?.[key] ?? "");
      cmp = av.localeCompare(bv, undefined, { numeric: true });
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  return copy;
}
