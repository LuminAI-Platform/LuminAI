import type { EntityType, PropertySchema } from "../../types";

export const EMPTY_ENTITY: EntityType = {
  name: "",
  label: "",
  description: "",
  color: "#3b82f6",
  icon: "package",
  properties: [],
};

export function hydrateInitialEntity(initial?: EntityType): EntityType {
  if (!initial) return EMPTY_ENTITY;
  let props = initial.properties ?? [];
  const rawSchema = (
    initial as unknown as {
      propertiesSchema?: string | Record<string, unknown>;
    }
  ).propertiesSchema;
  if ((!props || props.length === 0) && rawSchema) {
    try {
      const parsed =
        typeof rawSchema === "string" ? JSON.parse(rawSchema) : rawSchema;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as Record<string, unknown>).properties
      ) {
        const schemaProps = (
          parsed as {
            properties: Record<
              string,
              { type?: string; default?: unknown; description?: string }
            >;
          }
        ).properties;
        const reqList = Array.isArray(
          (parsed as { required?: string[] }).required,
        )
          ? (parsed as { required: string[] }).required
          : [];
        props = Object.entries(schemaProps).map(([name, def]) => ({
          id: name,
          name,
          type: (def?.type
            ? def.type.toUpperCase()
            : "STRING") as PropertySchema["type"],
          required: reqList.includes(name),
          defaultValue: def?.default !== undefined ? String(def.default) : "",
          description: def?.description || "",
        }));
      }
    } catch {
      // fallback
    }
  }
  return { ...initial, properties: props };
}
