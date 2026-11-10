// ─── Ontology Types ─────────────────────────────────────────────────────────

export type PropertyType =
  | "STRING"
  | "INTEGER"
  | "FLOAT"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "ARRAY"
  | "OBJECT";

export interface PropertySchema {
  id: string;
  name: string;
  type: PropertyType;
  required: boolean;
  defaultValue: string;
  description: string;
}

export interface EntityType {
  id?: string;
  name: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  properties: PropertySchema[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}
