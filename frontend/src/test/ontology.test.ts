import { describe, it, expect } from "vitest";
import { DOMAIN_STARTER_PACKS } from "../features/ontology/domainTemplates";

// Test sanitization and inference logic
function sanitizeEntityName(raw: string): string {
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

function sanitizePropertyName(raw: string): string {
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

function inferTypeFromDataType(dt?: string): string {
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

describe("Ontology Domain Starter Packs", () => {
  it("provides valid starter packs with entity definitions", () => {
    expect(DOMAIN_STARTER_PACKS.length).toBeGreaterThanOrEqual(4);
    for (const pack of DOMAIN_STARTER_PACKS) {
      expect(pack.id).toBeTruthy();
      expect(pack.domain).toBeTruthy();
      expect(pack.entityTypes.length).toBeGreaterThan(0);
      for (const et of pack.entityTypes) {
        expect(et.name).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
        expect(et.properties.length).toBeGreaterThan(0);
      }
    }
  });

  it("ensures all template relationships point to existing entity types in the pack", () => {
    for (const pack of DOMAIN_STARTER_PACKS) {
      if (!pack.relationships) continue;
      const entityNames = new Set(pack.entityTypes.map((e) => e.name));
      for (const rel of pack.relationships) {
        expect(entityNames.has(rel.sourceEntity)).toBe(true);
        expect(entityNames.has(rel.targetEntity)).toBe(true);
        expect([
          "ONE_TO_ONE",
          "ONE_TO_MANY",
          "MANY_TO_ONE",
          "MANY_TO_MANY",
        ]).toContain(rel.cardinality);
      }
    }
  });
});

describe("Ontology Auto-Generation Sanitization & Inference", () => {
  it("sanitizes filenames into valid PascalCase entity names", () => {
    expect(sanitizeEntityName("customers.csv")).toBe("Customers");
    expect(sanitizeEntityName("social_media_usage_2026.json")).toBe(
      "SocialMediaUsage2026",
    );
    expect(sanitizeEntityName("123_sensor_feed.parquet")).toBe("123SensorFeed");
    expect(sanitizeEntityName("order-items-export")).toBe("OrderItemsExport");
  });

  it("sanitizes dataset headers into clean camelCase property names", () => {
    expect(sanitizePropertyName("customer_id")).toBe("customerId");
    expect(sanitizePropertyName("TOTAL_AMOUNT_USD")).toBe("totalAmountUsd");
    expect(sanitizePropertyName("date of birth")).toBe("dateOfBirth");
    expect(sanitizePropertyName("is_active_flag")).toBe("isActiveFlag");
  });

  it("infers appropriate ontology data types from tabular schemas", () => {
    expect(inferTypeFromDataType("BIGINT")).toBe("integer");
    expect(inferTypeFromDataType("DOUBLE PRECISION")).toBe("float");
    expect(inferTypeFromDataType("NUMERIC(12,2)")).toBe("float");
    expect(inferTypeFromDataType("BOOLEAN")).toBe("boolean");
    expect(inferTypeFromDataType("DATE")).toBe("date");
    expect(inferTypeFromDataType("TIMESTAMPTZ")).toBe("datetime");
    expect(inferTypeFromDataType("VARCHAR(255)")).toBe("string");
    expect(inferTypeFromDataType(undefined)).toBe("string");
  });
});
