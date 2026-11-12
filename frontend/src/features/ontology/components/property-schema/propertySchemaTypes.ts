// ─── PropertySchema — types, constants & pure helpers ────────────────────────

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

export const PROPERTY_TYPES: {
  value: PropertyType;
  label: string;
  color: string;
}[] = [
  { value: "STRING", label: "String", color: "#60a5fa" },
  { value: "INTEGER", label: "Integer", color: "#a78bfa" },
  { value: "FLOAT", label: "Float", color: "#c084fc" },
  { value: "BOOLEAN", label: "Boolean", color: "#34d399" },
  { value: "DATE", label: "Date", color: "#fb923c" },
  { value: "DATETIME", label: "DateTime", color: "#f97316" },
  { value: "ARRAY", label: "Array", color: "#facc15" },
  { value: "OBJECT", label: "Object", color: "#94a3b8" },
];

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function emptyProperty(): PropertySchema {
  return {
    id: generateId(),
    name: "",
    type: "STRING",
    required: false,
    defaultValue: "",
    description: "",
  };
}

export function getTypeColor(type: PropertyType): string {
  return PROPERTY_TYPES.find((t) => t.value === type)?.color ?? "#94a3b8";
}
