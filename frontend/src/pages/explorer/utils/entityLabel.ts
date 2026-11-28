import { formatPropertyLabel } from "./entityFormatting";
import { isSensitiveField, maskSensitiveValue } from "./privacyMask";

export interface LabelableEntity {
  id: string;
  canonicalName?: string | null;
  entityType?: string | null;
  properties?: Record<string, unknown> | null;
}

export type TypeLabelField =
  | { kind: "name"; key: string }
  | { kind: "identifier"; key: string; label: string }
  | { kind: "fallback" };

export type TypeLabelFieldMap = Record<string, TypeLabelField>;

const NAME_KEY_PRIORITY = [
  "name",
  "full_name",
  "display_name",
  "title",
  "label",
] as const;

const QUALITY_KEY_NORMALIZED = new Set([
  "quality_score",
  "qualityscore",
  "data_quality_score",
  "dataqualityscore",
  "quality_state",
  "qualitystate",
  "data_quality_state",
  "dataqualitystate",
]);

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .replace(/^_+/, "")
    .toLowerCase();
}

function hasNonEmptyValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "object") return false;
  return String(val).trim().length > 0;
}

function getNameKeyPriorityIndex(key: string): number {
  const norm = normalizeKey(key);
  return NAME_KEY_PRIORITY.indexOf(norm as (typeof NAME_KEY_PRIORITY)[number]);
}

function isIdentifierPropertyKey(key: string): boolean {
  const norm = normalizeKey(key);
  if (!norm || QUALITY_KEY_NORMALIZED.has(norm)) return false;
  if (norm === "entity_type" || norm === "canonical_name") return false;
  if (norm === "id" || norm.endsWith("_id")) return true;
  if (
    norm.includes("code") ||
    norm.includes("number") ||
    norm.includes("reference")
  ) {
    return true;
  }
  return false;
}

function isGenericOrNumericCanonicalName(
  canonicalName: string,
  entityId: string,
  properties: Record<string, unknown>,
): boolean {
  const trimmed = canonicalName.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (
    lower === "unnamed entity" ||
    lower === "unknown" ||
    lower === "entity" ||
    lower === `entity ${entityId.slice(0, 8).toLowerCase()}`
  ) {
    return true;
  }
  // Pure numeric values (e.g. an Age like "24" or bare row number) are never valid entity titles
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return true;
  }
  // If canonicalName merely echoes a non-name, non-identifier property (e.g. Gender = "Female"),
  // do not promote that arbitrary property as the entity title.
  for (const [k, v] of Object.entries(properties)) {
    if (!hasNonEmptyValue(v)) continue;
    if (getNameKeyPriorityIndex(k) >= 0 || isIdentifierPropertyKey(k)) {
      continue;
    }
    if (String(v).trim() === trimmed) {
      return true;
    }
  }
  return false;
}

/**
 * Selects the label field rule for a single entity's property map:
 * (a) key matching name, full_name, display_name, title, label
 * (b) identifier key (ends with id, or contains code, number, reference)
 * (c) fallback
 */
export function selectLabelFieldFromProperties(
  properties: Record<string, unknown> | null | undefined,
): TypeLabelField {
  if (!properties) return { kind: "fallback" };

  let bestNameKey: string | null = null;
  let bestNameRank = Infinity;

  for (const [key, val] of Object.entries(properties)) {
    if (!hasNonEmptyValue(val)) continue;
    const rank = getNameKeyPriorityIndex(key);
    if (rank >= 0 && rank < bestNameRank) {
      bestNameRank = rank;
      bestNameKey = key;
    }
  }

  if (bestNameKey) {
    return { kind: "name", key: bestNameKey };
  }

  for (const [key, val] of Object.entries(properties)) {
    if (!hasNonEmptyValue(val)) continue;
    if (isIdentifierPropertyKey(key)) {
      return {
        kind: "identifier",
        key,
        label: formatPropertyLabel(key),
      };
    }
  }

  return { kind: "fallback" };
}

/**
 * Computes a consistent label field per entity type from a page of entities.
 * Preserves existing mappings from `existingMap` so the label field chosen on
 * the first loaded page stays consistent across subsequent pages.
 */
export function computeEntityTypeLabelFields(
  entities: LabelableEntity[],
  existingMap: TypeLabelFieldMap = {},
): TypeLabelFieldMap {
  const nextMap: TypeLabelFieldMap = { ...existingMap };
  const grouped = new Map<string, LabelableEntity[]>();

  for (const entity of entities) {
    const typeKey = (entity.entityType || "Entity").trim().toLowerCase();
    if (nextMap[typeKey]) continue;
    const list = grouped.get(typeKey);
    if (list) list.push(entity);
    else grouped.set(typeKey, [entity]);
  }

  for (const [typeKey, group] of grouped.entries()) {
    // (a) Count name-like keys across the entities of this type
    const nameKeyCounts = new Map<string, { count: number; rank: number }>();
    const idKeyCounts = new Map<string, number>();

    for (const entity of group) {
      const props = entity.properties || {};
      for (const [key, val] of Object.entries(props)) {
        if (!hasNonEmptyValue(val)) continue;
        const rank = getNameKeyPriorityIndex(key);
        if (rank >= 0) {
          const prev = nameKeyCounts.get(key);
          nameKeyCounts.set(key, {
            count: (prev?.count ?? 0) + 1,
            rank,
          });
        } else if (isIdentifierPropertyKey(key)) {
          idKeyCounts.set(key, (idKeyCounts.get(key) ?? 0) + 1);
        }
      }
    }

    if (nameKeyCounts.size > 0) {
      const [chosenKey] = Array.from(nameKeyCounts.entries()).sort((a, b) => {
        if (a[1].rank !== b[1].rank) return a[1].rank - b[1].rank;
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return a[0].localeCompare(b[0]);
      })[0];
      nextMap[typeKey] = { kind: "name", key: chosenKey };
      continue;
    }

    if (idKeyCounts.size > 0) {
      const [chosenKey] = Array.from(idKeyCounts.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })[0];
      nextMap[typeKey] = {
        kind: "identifier",
        key: chosenKey,
        label: formatPropertyLabel(chosenKey),
      };
      continue;
    }

    nextMap[typeKey] = { kind: "fallback" };
  }

  return nextMap;
}

/**
 * Resolves the display label for an entity using the per-type label field map.
 * Respects sensitive data masking if the chosen identifier/name key is sensitive.
 */
export function resolveEntityLabel(
  entity: LabelableEntity,
  typeLabelFields?: TypeLabelFieldMap,
  maskSensitive = false,
): string {
  const shortId = (entity.id || "").slice(0, 8) || "Unknown";
  const props = entity.properties || {};
  const typeKey = (entity.entityType || "Entity").trim().toLowerCase();

  const rule =
    typeLabelFields?.[typeKey] ?? selectLabelFieldFromProperties(props);

  if (rule.kind === "name") {
    const rawVal = props[rule.key];
    if (hasNonEmptyValue(rawVal)) {
      const formatted =
        maskSensitive && isSensitiveField(rule.key)
          ? maskSensitiveValue(rule.key, rawVal, true)
          : String(rawVal).trim();
      if (formatted) return formatted;
    }
  } else if (rule.kind === "identifier") {
    const rawVal = props[rule.key];
    if (hasNonEmptyValue(rawVal)) {
      const formatted =
        maskSensitive && isSensitiveField(rule.key)
          ? maskSensitiveValue(rule.key, rawVal, true)
          : String(rawVal).trim();
      if (formatted) return `${rule.label}: ${formatted}`;
    }
  }

  if (
    entity.canonicalName &&
    !isGenericOrNumericCanonicalName(entity.canonicalName, entity.id, props)
  ) {
    return entity.canonicalName.trim();
  }

  return shortId;
}

/**
 * Truncates long strings in the middle so distinguishing suffixes remain visible.
 */
export function truncateMiddle(text: string, maxLength = 34): string {
  if (!text || text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  const keep = maxLength - 1;
  const front = Math.ceil(keep * 0.55);
  const back = keep - front;
  return `${text.slice(0, front).trimEnd()}…${text.slice(text.length - back).trimStart()}`;
}

export function isQualityPropertyKey(key: string): boolean {
  return QUALITY_KEY_NORMALIZED.has(normalizeKey(key));
}

export interface ExtractedQualityMetadata {
  qualityScore: string | number | null;
  qualityState: string | null;
  sourceProperties: Record<string, unknown>;
}

/**
 * Separates backend-stored quality properties (Quality Score, Quality State)
 * from ordinary source properties so the drawer can display them in a dedicated section.
 */
export function extractQualityMetadata(
  properties: Record<string, unknown> | null | undefined,
): ExtractedQualityMetadata {
  let qualityScore: string | number | null = null;
  let qualityState: string | null = null;
  const sourceProperties: Record<string, unknown> = {};

  if (!properties) {
    return { qualityScore, qualityState, sourceProperties };
  }

  for (const [key, val] of Object.entries(properties)) {
    const norm = normalizeKey(key);
    if (
      norm === "quality_score" ||
      norm === "qualityscore" ||
      norm === "data_quality_score" ||
      norm === "dataqualityscore"
    ) {
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        qualityScore = typeof val === "number" ? val : String(val).trim();
      }
      continue;
    }
    if (
      norm === "quality_state" ||
      norm === "qualitystate" ||
      norm === "data_quality_state" ||
      norm === "dataqualitystate"
    ) {
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        qualityState = String(val).trim();
      }
      continue;
    }
    sourceProperties[key] = val;
  }

  return { qualityScore, qualityState, sourceProperties };
}
