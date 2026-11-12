import type { OntologyProperty } from "../../../features/connections/components/VisualSchemaMapper";

export function parseEntityProperties(t: {
  name: string;
  label?: string;
  properties?: Array<{
    name: string;
    type?: string;
    dataType?: string;
    required?: boolean;
    description?: string;
  }>;
  propertiesSchema?: string | Record<string, unknown>;
}): OntologyProperty[] {
  if (Array.isArray(t.properties) && t.properties.length > 0) {
    return t.properties.map((p, idx) => ({
      id: p.name || `p_${idx}`,
      name: p.name,
      entityClass: t.name,
      expectedType: p.dataType || p.type || "string",
      required: Boolean(p.required),
      description: p.description || p.name,
    }));
  }

  if (t.propertiesSchema) {
    try {
      const parsed =
        typeof t.propertiesSchema === "string"
          ? JSON.parse(t.propertiesSchema)
          : t.propertiesSchema;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as Record<string, unknown>).properties
      ) {
        const schemaProps = (
          parsed as {
            properties: Record<
              string,
              { type?: string; description?: string; default?: unknown }
            >;
          }
        ).properties;
        const requiredList = Array.isArray(
          (parsed as { required?: string[] }).required,
        )
          ? ((parsed as { required: string[] }).required as string[])
          : [];

        const props = Object.entries(schemaProps).map(([pName, pDef]) => ({
          id: pName,
          name: pName,
          entityClass: t.name,
          expectedType: pDef?.type || "string",
          required: requiredList.includes(pName),
          description: pDef?.description || pName,
        }));

        if (props.length > 0) {
          return props;
        }
      }
    } catch {
      // ignore
    }
  }

  return [
    {
      id: "id",
      name: "id",
      entityClass: t.name,
      expectedType: "string",
      required: true,
      description: "ID",
    },
    {
      id: "name",
      name: "name",
      entityClass: t.name,
      expectedType: "string",
      required: true,
      description: "Name",
    },
  ];
}

export function sanitizeEntityName(rawName: string): string {
  if (!rawName) return "CustomEntity";
  let cleaned = rawName.replace(/\.(csv|tsv|json|xlsx|parquet|zip)$/i, "");
  cleaned = cleaned.split(".").pop() || cleaned;
  cleaned = cleaned.replace(/(_csv|_xlsx|_json)$/i, "");
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  if (!/^[a-zA-Z]/.test(pascal)) {
    pascal = "Entity_" + pascal;
  }
  if (pascal.length < 2) {
    pascal = pascal + "_Record";
  }
  return pascal;
}

export function sanitizePropertyName(rawName: string): string {
  if (!rawName) return "field";
  const words = rawName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "field";
  let camel = words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  if (!/^[a-zA-Z]/.test(camel)) {
    camel = "col_" + camel;
  }
  return camel;
}

export function inferPropertyType(colType?: string): string {
  if (!colType) return "string";
  const lower = colType.toLowerCase();
  if (
    lower.includes("int") ||
    lower.includes("decimal") ||
    lower.includes("float") ||
    lower.includes("double") ||
    lower.includes("num")
  ) {
    return "number";
  }
  if (lower.includes("date") || lower.includes("time")) {
    return "date";
  }
  if (lower.includes("bool")) {
    return "boolean";
  }
  if (
    lower.includes("json") ||
    lower.includes("object") ||
    lower.includes("array")
  ) {
    return "json";
  }
  return "string";
}
