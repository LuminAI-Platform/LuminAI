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

export interface ConnectorLine {
  id?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const DATA_TYPE_COLORS: Record<string, string> = {
  string: "text-success bg-success-bg border-success-border",
  integer: "text-primary bg-primary-tint border-primary-border",
  float: "text-primary bg-primary-tint border-primary-border",
  boolean: "text-warning bg-warning-bg border-warning-border",
  timestamp: "text-text-secondary bg-surface-subtle border-border",
  json: "text-warning bg-warning-bg border-warning-border",
};

export const DEFAULT_TARGET_ENTITIES: string[] = [];

export const DEFAULT_RELATION_TYPES: string[] = [];

export interface SchemaMappingBatchRequest {
  connectorId: string;
  sourceTable: string;
  targetEntity: string;
  mappings: Array<{
    sourceColumn: string;
    targetEntityType: string;
    targetProperty: string;
    transformation: string;
  }>;
  foreignKeys: ForeignKeyDefinition[];
}

const CONNECTOR_UUID_PATTERN =
  /^(?:conn_)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function extractConnectorUuid(connectionId: string): string | null {
  const match = connectionId.trim().match(CONNECTOR_UUID_PATTERN);
  return match ? match[1] : null;
}

export function buildSchemaMappingBatchPayload(params: {
  connectorId: string;
  sourceTable: string;
  targetEntity: string;
  mappings: SchemaMapping[];
  foreignKeys: ForeignKeyDefinition[];
  sourceColumns: SourceColumn[];
  ontologyProperties: OntologyProperty[];
}): SchemaMappingBatchRequest {
  return {
    connectorId: params.connectorId,
    sourceTable: params.sourceTable,
    targetEntity: params.targetEntity,
    mappings: params.mappings.map((m) => {
      const sourceCol =
        params.sourceColumns.find((c) => c.id === m.sourceColumnId)?.name ??
        m.sourceColumnId;
      const targetProp =
        params.ontologyProperties.find((p) => p.id === m.ontologyPropertyId)
          ?.name ?? m.ontologyPropertyId;
      return {
        sourceColumn: sourceCol,
        targetEntityType: params.targetEntity,
        targetProperty: targetProp,
        transformation: "NONE",
      };
    }),
    foreignKeys: params.foreignKeys,
  };
}

export function inferDefaultRelationship(
  colName: string,
  availableEntities: string[] = [],
  availableRelationshipTypes: string[] = [],
): {
  target: string;
  rel: string;
} {
  const lower = colName.toLowerCase().trim();
  const matchedEntity = availableEntities.find((entity) =>
    lower.includes(entity.toLowerCase()),
  );
  const target = matchedEntity ?? availableEntities[0] ?? "";
  const rel =
    availableRelationshipTypes[0] ??
    (target ? `RELATED_TO_${target.toUpperCase()}` : "LINKED_TO");
  return { target, rel };
}
