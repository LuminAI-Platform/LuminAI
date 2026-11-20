export interface AutoGenerateModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  type: string;
  status?: string;
  config?: string;
  createdAt?: string;
}

export interface InferredProp {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export function sanitizeEntityName(raw: string): string {
  const clean = raw
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .trim();
  if (!clean) return "GeneratedEntity";
  return clean
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function sanitizePropertyName(raw: string): string {
  const clean = raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .trim();
  if (!clean) return "prop";
  const parts = clean.split("_").filter(Boolean);
  if (parts.length === 0) return "prop";
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")
  );
}

export function inferTypeFromDataType(dt?: string): string {
  if (!dt) return "string";
  const lower = dt.toLowerCase();
  if (
    lower.includes("int") ||
    lower.includes("long") ||
    lower.includes("bigint")
  ) {
    return "integer";
  }
  if (
    lower.includes("float") ||
    lower.includes("double") ||
    lower.includes("decimal") ||
    lower.includes("num")
  ) {
    return "float";
  }
  if (lower.includes("bool")) {
    return "boolean";
  }
  if (lower.includes("date") && !lower.includes("time")) {
    return "date";
  }
  if (lower.includes("time") || lower.includes("timestamp")) {
    return "datetime";
  }
  return "string";
}
