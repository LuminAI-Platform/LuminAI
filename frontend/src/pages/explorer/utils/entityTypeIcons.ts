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
