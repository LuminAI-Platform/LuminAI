import type {
  ExplorerInsightCounts,
  MatchReason,
  PossibleDuplicateRef,
  SearchResultItem,
} from "../types";

/**
 * Normalizes a single raw entity item from the search API into SearchResultItem.
 * Preserves only fields actually returned by the API.
 */
export function normalizeSearchResultItem(
  item: Record<string, unknown>,
): SearchResultItem {
  const id = String(
    item.id || item.entityId || "00000000-0000-0000-0000-000000000000",
  );
  const rawProps =
    item.properties && typeof item.properties === "object"
      ? (item.properties as Record<string, unknown>)
      : {};
  const canonicalName = String(
    item.canonicalName ||
      item.name ||
      rawProps.canonicalName ||
      rawProps.name ||
      rawProps.title ||
      rawProps.full_name ||
      `Entity ${id.slice(0, 8)}`,
  );
  const entityType = String(
    item.entityType ||
      item.type ||
      rawProps.entityType ||
      rawProps.type ||
      "Entity",
  );

  const confidenceScore =
    typeof item.confidenceScore === "number" &&
    Number.isFinite(item.confidenceScore)
      ? item.confidenceScore
      : undefined;

  const sourceCount =
    typeof item.sourceCount === "number" && Number.isFinite(item.sourceCount)
      ? item.sourceCount
      : undefined;

  const sourceSystems = Array.isArray(item.sourceSystems)
    ? item.sourceSystems.map((s) => String(s).trim()).filter(Boolean)
    : undefined;

  const createdAt =
    typeof item.createdAt === "string" && item.createdAt.trim()
      ? item.createdAt
      : undefined;

  const updatedAt =
    typeof item.updatedAt === "string" && item.updatedAt.trim()
      ? item.updatedAt
      : undefined;

  const matchReasons = Array.isArray(item.matchReasons)
    ? (item.matchReasons as MatchReason[])
    : undefined;

  let possibleDuplicate: PossibleDuplicateRef | null | undefined;
  if (item.possibleDuplicate && typeof item.possibleDuplicate === "object") {
    const dup = item.possibleDuplicate as Record<string, unknown>;
    const dupName = String(dup.canonicalName || dup.name || "").trim();
    if (dupName) {
      possibleDuplicate = {
        id: dup.id ? String(dup.id) : undefined,
        name: dupName,
        candidateId: dup.candidateId ? String(dup.candidateId) : undefined,
      };
    }
  }

  const needsReview =
    typeof item.needsReview === "boolean" ? item.needsReview : undefined;

  return {
    id,
    canonicalName,
    entityType,
    properties: rawProps,
    createdAt,
    updatedAt,
    confidenceScore,
    sourceCount,
    sourceSystems,
    highlights:
      item.highlights && typeof item.highlights === "object"
        ? (item.highlights as Record<string, string[]>)
        : undefined,
    matchReasons,
    possibleDuplicate,
    needsReview,
  };
}

/**
 * Parses optional insight counts returned by the search API.
 */
export function parseExplorerInsights(
  rawInsights: unknown,
): ExplorerInsightCounts | undefined {
  if (!rawInsights || typeof rawInsights !== "object") return undefined;

  const rawIns = rawInsights as Record<string, unknown>;
  const parsed: ExplorerInsightCounts = {};
  if (typeof rawIns.possibleDuplicates === "number") {
    parsed.possibleDuplicates = rawIns.possibleDuplicates;
  }
  if (typeof rawIns.missingValues === "number") {
    parsed.missingValues = rawIns.missingValues;
  }
  if (typeof rawIns.needsReview === "number") {
    parsed.needsReview = rawIns.needsReview;
  }
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}
