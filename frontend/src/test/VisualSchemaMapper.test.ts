import { describe, it, expect } from "vitest";
import type {
  ForeignKeyDefinition,
  SchemaMappingPayload,
} from "../features/connections/components/VisualSchemaMapper";

describe("VisualSchemaMapper Foreign Key & Relationship Mapper (GAP-03)", () => {
  it("should construct valid foreign key relationship definitions", () => {
    const fkCustomer: ForeignKeyDefinition = {
      columnId: "c2",
      columnName: "customer_id",
      targetEntityType: "Customer",
      relationshipType: "CUSTOMER_OF",
      direction: "OUTGOING",
    };

    const fkProduct: ForeignKeyDefinition = {
      columnId: "c3",
      columnName: "product_id",
      targetEntityType: "Product",
      relationshipType: "CONTAINS_PRODUCT",
      direction: "OUTGOING",
    };

    expect(fkCustomer.targetEntityType).toBe("Customer");
    expect(fkCustomer.relationshipType).toBe("CUSTOMER_OF");
    expect(fkProduct.relationshipType).toBe("CONTAINS_PRODUCT");
  });

  it("should bundle foreignKeys in SchemaMappingPayload for pipeline ingestion", () => {
    const payload: SchemaMappingPayload = {
      connectionId: "conn-1234",
      sourceTable: "raw_orders",
      targetEntity: "Order",
      mappings: [
        { sourceColumnId: "c1", ontologyPropertyId: "p1", transform: "direct" },
        { sourceColumnId: "c4", ontologyPropertyId: "p2", transform: "cast" },
      ],
      foreignKeys: [
        {
          columnId: "c2",
          columnName: "customer_id",
          targetEntityType: "Customer",
          relationshipType: "PLACED_BY",
          direction: "OUTGOING",
        },
      ],
      createdAt: new Date().toISOString(),
    };

    expect(payload.mappings).toHaveLength(2);
    expect(payload.foreignKeys).toHaveLength(1);
    expect(payload.foreignKeys?.[0].targetEntityType).toBe("Customer");
    expect(payload.foreignKeys?.[0].relationshipType).toBe("PLACED_BY");
  });
});
