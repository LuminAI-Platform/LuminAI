import { describe, it, expect } from "vitest";
import type {
  ForeignKeyDefinition,
  SchemaMappingPayload,
} from "../features/connections/components/VisualSchemaMapper";
import {
  extractConnectorUuid,
  buildSchemaMappingBatchPayload,
} from "../features/connections/components/visual-schema/visualSchemaTypes";
import { reconcileForeignKeys } from "../features/connections/components/visual-schema/useForeignKeyState";

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

  it("extracts connector UUID from conn_ and archive-suffixed identifiers", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    expect(extractConnectorUuid(`conn_${uuid}`)).toBe(uuid);
    expect(extractConnectorUuid(`conn_${uuid}_orders.csv`)).toBe(uuid);
    expect(extractConnectorUuid(uuid)).toBe(uuid);
    expect(extractConnectorUuid("conn_default")).toBeNull();
  });

  it("builds atomic batch save payload mapping columns, ontology properties, and foreignKeys", () => {
    const batch = buildSchemaMappingBatchPayload({
      connectorId: "123e4567-e89b-12d3-a456-426614174000",
      sourceTable: "raw_orders",
      targetEntity: "Order",
      sourceColumns: [
        { id: "col_1", name: "order_number", dataType: "string" },
        { id: "col_2", name: "customer_id", dataType: "string" },
      ],
      ontologyProperties: [
        {
          id: "prop_1",
          name: "orderNumber",
          entityClass: "Order",
          expectedType: "string",
          required: true,
        },
      ],
      mappings: [
        {
          sourceColumnId: "col_1",
          ontologyPropertyId: "prop_1",
          transform: "direct",
        },
      ],
      foreignKeys: [
        {
          columnId: "col_2",
          columnName: "customer_id",
          targetEntityType: "Customer",
          relationshipType: "PLACED_BY",
          direction: "OUTGOING",
        },
      ],
    });

    expect(batch.mappings).toEqual([
      {
        sourceColumn: "order_number",
        targetEntityType: "Order",
        targetProperty: "orderNumber",
        transformation: "NONE",
      },
    ]);
    expect(batch.foreignKeys).toHaveLength(1);
    expect(batch.foreignKeys[0].columnName).toBe("customer_id");
  });

  it("reconciles backend foreignKeys against live source columns even when localStorage is empty", () => {
    const reconciled = reconcileForeignKeys(
      [
        {
          columnId: "old_col_idx",
          columnName: "Customer_ID",
          targetEntityType: "Customer",
          relationshipType: "PLACED_BY",
          direction: "OUTGOING",
        },
      ],
      [{ id: "col_2", name: "customer_id", dataType: "string" }],
      null,
    );

    expect(Object.keys(reconciled)).toEqual(["col_2"]);
    expect(reconciled.col_2.columnId).toBe("col_2");
    expect(reconciled.col_2.columnName).toBe("customer_id");
    expect(reconciled.col_2.relationshipType).toBe("PLACED_BY");
  });
});
