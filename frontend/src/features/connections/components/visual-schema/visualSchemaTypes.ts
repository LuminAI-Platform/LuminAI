export interface SourceColumn {
  id: string;
  name: string;
  dataType: "string" | "integer" | "float" | "boolean" | "timestamp" | "json";
  sample?: string;
  nullable?: boolean;
}

export interface OntologyProperty {
  id: string;
  name: string;
  entityClass: string;
  expectedType: string;
  required: boolean;
  description?: string;
}

export interface SchemaMapping {
  sourceColumnId: string;
  ontologyPropertyId: string;
  transform?: "direct" | "cast" | "normalize";
}

export interface ForeignKeyDefinition {
  columnId: string;
  columnName: string;
  targetEntityType: string;
  relationshipType: string;
  direction: "OUTGOING" | "INCOMING";
}

export interface SchemaMappingPayload {
  connectionId: string;
  sourceTable: string;
  targetEntity: string;
  mappings: SchemaMapping[];
  foreignKeys?: ForeignKeyDefinition[];
  createdAt: string;
}

export const DATA_TYPE_COLORS: Record<string, string> = {
  string: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  integer: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  float: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  boolean: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  timestamp: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  json: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

export const DEFAULT_TARGET_ENTITIES = [
  "Customer",
  "User",
  "Order",
  "Product",
  "Account",
  "Organization",
  "Transaction",
  "Person",
  "Location",
  "Device",
  "Supplier",
];

export const DEFAULT_RELATION_TYPES = [
  "CUSTOMER_OF",
  "PLACED_BY",
  "CONTAINS_PRODUCT",
  "CREATED_BY",
  "ACCOUNT_OF",
  "PART_OF_ORDER",
  "ORGANIZATION_OF",
  "SOLD_BY",
  "BOUGHT_BY",
  "SUPPLIED_BY",
  "ASSOCIATED_WITH",
  "LINKED_TO",
];

export function inferDefaultRelationship(colName: string): {
  target: string;
  rel: string;
} {
  const lower = colName.toLowerCase().trim();
  if (lower.includes("customer"))
    return { target: "Customer", rel: "CUSTOMER_OF" };
  if (lower.includes("user")) return { target: "User", rel: "CREATED_BY" };
  if (lower.includes("order")) return { target: "Order", rel: "PART_OF_ORDER" };
  if (lower.includes("product") || lower.includes("item"))
    return { target: "Product", rel: "CONTAINS_PRODUCT" };
  if (lower.includes("account"))
    return { target: "Account", rel: "ACCOUNT_OF" };
  if (lower.includes("org"))
    return { target: "Organization", rel: "ORGANIZATION_OF" };
  if (
    lower.includes("supplier") ||
    lower.includes("seller") ||
    lower.includes("vendor")
  ) {
    return { target: "Supplier", rel: "SUPPLIED_BY" };
  }
  return { target: "Customer", rel: "LINKED_TO" };
}
