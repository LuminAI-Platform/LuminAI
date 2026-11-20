import type { DomainTemplate } from "./types";

export const LOGISTICS_TEMPLATE: DomainTemplate = {
  id: "logistics",
  domain: "Supply Chain",
  name: "Fleet & Freight Operations",
  badge: "Logistics",
  badgeColor: "text-primary bg-primary-tint border-primary-border",
  description:
    "Global logistics tracking for warehouses, cargo shipments, and transport carriers.",
  entityTypes: [
    {
      name: "Warehouse",
      label: "Facility / Warehouse",
      color: "#f59e0b",
      icon: "building",
      description: "Physical storage facility or distribution hub",
      properties: [
        {
          name: "warehouseId",
          type: "string",
          required: true,
          description: "Facility identifier code",
        },
        {
          name: "facilityName",
          type: "string",
          required: true,
          description: "Name of hub or depot",
        },
        {
          name: "country",
          type: "string",
          required: true,
          description: "ISO country location",
        },
        {
          name: "capacityUnits",
          type: "integer",
          required: false,
          description: "Pallet storage capacity",
        },
      ],
    },
    {
      name: "Shipment",
      label: "Freight Shipment",
      color: "#06b6d4",
      icon: "globe",
      description: "Transport consignment moving between locations",
      properties: [
        {
          name: "shipmentId",
          type: "string",
          required: true,
          description: "Waybill or tracking number",
        },
        {
          name: "originCity",
          type: "string",
          required: true,
          description: "Origin port or city",
        },
        {
          name: "destinationCity",
          type: "string",
          required: true,
          description: "Destination port or city",
        },
        {
          name: "weightKg",
          type: "float",
          required: false,
          description: "Gross payload weight",
        },
        {
          name: "status",
          type: "string",
          required: true,
          description: "DISPATCHED, IN_TRANSIT, or DELIVERED",
        },
      ],
    },
  ],
  relationships: [
    {
      name: "DISPATCHED_FROM",
      label: "Dispatched From",
      sourceEntity: "Shipment",
      targetEntity: "Warehouse",
      cardinality: "MANY_TO_ONE",
      description: "Shipment originating at warehouse",
    },
  ],
};
