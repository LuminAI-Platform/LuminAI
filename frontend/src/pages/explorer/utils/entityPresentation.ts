import {
  User,
  Users,
  Activity,
  Building2,
  Building,
  Shield,
  Layers,
  FileText,
  Sparkles,
  Tag,
  Database,
  BarChart3,
  Compass,
  GitBranch,
  Network,
  Table,
  type LucideIcon,
} from "../../../lib/icons";

/**
 * Semantic Lucide icon map for known entity types.
 * Ensures distinct icons per entity type instead of using the same cube icon for all.
 */
const ENTITY_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  person: User,
  patient: User,
  customer: Users,
  employee: Users,
  physician: Activity,
  doctor: Activity,
  provider: Activity,
  organization: Building2,
  company: Building2,
  account: Building2,
  hospital: Building,
  clinic: Building,
  facility: Building,
  insurer: Shield,
  insurance: Shield,
  payer: Shield,
  department: Layers,
  unit: Layers,
  diagnosis: FileText,
  claim: FileText,
  invoice: FileText,
  order: FileText,
  medication: Sparkles,
  drug: Sparkles,
  product: Tag,
  dataset: Database,
  source: Database,
  transaction: BarChart3,
  payment: BarChart3,
  location: Compass,
  address: Compass,
  site: Compass,
  event: GitBranch,
  device: Network,
  record: Table,
};

const FALLBACK_ICON_POOL: LucideIcon[] = [
  User,
  Building2,
  Activity,
  Shield,
  Layers,
  FileText,
  Tag,
  Database,
  BarChart3,
  Compass,
  Network,
  Table,
];

/**
 * Returns a distinct, stable Lucide icon component for any entity type.
 * Never collapses all types to the same generic cube icon.
 */
export function getEntityTypeIcon(entityType?: string | null): LucideIcon {
  if (!entityType || !entityType.trim()) {
    return Network;
  }

  const lower = entityType.trim().toLowerCase();

  // Direct match
  if (ENTITY_TYPE_ICON_MAP[lower]) {
    return ENTITY_TYPE_ICON_MAP[lower];
  }

  // Partial keyword match (e.g. "HospitalPatient", "Customers100000", "DiabetesDataset")
  for (const [keyword, icon] of Object.entries(ENTITY_TYPE_ICON_MAP)) {
    if (lower.includes(keyword)) {
      return icon;
    }
  }

  // Deterministic hash across diverse icon pool
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash << 5) - hash + lower.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_ICON_POOL[Math.abs(hash) % FALLBACK_ICON_POOL.length];
}

/**
 * Formats a snake_case or camelCase property key into a clean, readable label.
 */
export function formatPropertyLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Formats an ISO timestamp into a compact relative time string (e.g. "5m ago", "2d ago").
 */
export function formatRelativeTime(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Formats an ISO timestamp into a clean short date (e.g. "Apr 1, 2026").
 */
export function formatShortDate(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface KeyCardField {
  key: string;
  label: string;
  value: unknown;
  isSystemDate?: boolean;
}

const TYPE_PRIORITY_KEYS: Record<string, string[]> = {
  person: [
    "email",
    "date_of_birth",
    "dob",
    "phone",
    "country",
    "city",
    "role",
    "source",
    "source_system",
  ],
  patient: [
    "date_of_birth",
    "dob",
    "email",
    "phone",
    "mrn",
    "gender",
    "blood_type",
    "insurance_id",
    "source",
  ],
  customer: [
    "email",
    "phone",
    "country",
    "city",
    "company",
    "source",
    "source_system",
  ],
  organization: [
    "industry",
    "domain",
    "website",
    "country",
    "city",
    "email",
    "phone",
    "source",
  ],
  company: [
    "industry",
    "domain",
    "website",
    "country",
    "city",
    "email",
    "source",
  ],
  hospital: [
    "location",
    "city",
    "state",
    "country",
    "phone",
    "beds",
    "type",
    "source",
  ],
  physician: [
    "specialty",
    "department",
    "email",
    "phone",
    "hospital",
    "npi",
    "source",
  ],
  doctor: ["specialty", "department", "email", "phone", "hospital", "source"],
  product: ["sku", "category", "price", "brand", "status", "source"],
  transaction: ["amount", "currency", "status", "date", "merchant", "source"],
  location: ["city", "state", "country", "postal_code", "address", "source"],
};

const SKIP_CARD_KEYS = new Set([
  "canonical_name",
  "canonicalname",
  "entity_type",
  "entitytype",
  "id",
  "uuid",
]);

/**
 * Selects 3 to 4 key fields for an entity card based on its entity type.
 * Remaining properties are kept for the detail drawer, not crowded onto the card.
 */
export function pickKeyCardFields(
  entityType: string,
  properties: Record<string, unknown>,
  createdAt?: string,
  maxFields = 4,
): KeyCardField[] {
  const entries = Object.entries(properties).filter(
    ([key, val]) =>
      !SKIP_CARD_KEYS.has(key.toLowerCase()) &&
      val !== null &&
      val !== undefined &&
      String(val).trim() !== "",
  );

  const lowerType = (entityType || "").trim().toLowerCase();
  let priorityList: string[] = [];
  for (const [typeKey, keys] of Object.entries(TYPE_PRIORITY_KEYS)) {
    if (lowerType === typeKey || lowerType.includes(typeKey)) {
      priorityList = keys;
      break;
    }
  }

  const picked: KeyCardField[] = [];
  const usedKeys = new Set<string>();

  // 1. Pick priority fields for this entity type first
  for (const pKey of priorityList) {
    if (picked.length >= maxFields) break;
    const match = entries.find(
      ([k]) => !usedKeys.has(k) && k.toLowerCase() === pKey,
    );
    if (match) {
      usedKeys.add(match[0]);
      picked.push({
        key: match[0],
        label: formatPropertyLabel(match[0]),
        value: match[1],
      });
    }
  }

  // 2. Fill remaining slots up to maxFields with other non-empty properties
  for (const [k, v] of entries) {
    if (picked.length >= maxFields) break;
    if (!usedKeys.has(k)) {
      usedKeys.add(k);
      picked.push({
        key: k,
        label: formatPropertyLabel(k),
        value: v,
      });
    }
  }

  // 3. If fewer than 3 fields and createdAt is returned by API, append Created date
  if (picked.length < 3 && createdAt) {
    const formatted = formatShortDate(createdAt);
    if (formatted) {
      picked.push({
        key: "createdAt",
        label: "Created",
        value: formatted,
        isSystemDate: true,
      });
    }
  }

  return picked;
}
