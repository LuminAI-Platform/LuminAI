import type { DomainTemplate } from "./types";

export const ECOMMERCE_TEMPLATE: DomainTemplate = {
  id: "ecommerce",
  domain: "E-Commerce",
  name: "Retail & Order Management",
  badge: "Retail",
  badgeColor: "text-warning bg-warning-bg border-warning-border",
  description:
    "Standard retail models for customers, items, orders, and payments.",
  entityTypes: [
    {
      name: "Shopper",
      label: "Shopper",
      color: "#ec4899",
      icon: "user",
      description: "E-Commerce store customer",
      properties: [
        {
          name: "shopperId",
          type: "string",
          required: true,
          description: "Customer account identifier",
        },
        {
          name: "email",
          type: "string",
          required: true,
          description: "Email address",
        },
        {
          name: "fullName",
          type: "string",
          required: true,
          description: "Customer name",
        },
        {
          name: "loyaltyPoints",
          type: "integer",
          required: false,
          description: "Reward points",
        },
      ],
    },
    {
      name: "Product",
      label: "Product",
      color: "#3b82f6",
      icon: "package",
      description: "Store item catalog",
      properties: [
        {
          name: "productId",
          type: "string",
          required: true,
          description: "Product SKU / catalog ID",
        },
        {
          name: "title",
          type: "string",
          required: true,
          description: "Item title",
        },
        {
          name: "category",
          type: "string",
          required: false,
          description: "Department or category",
        },
        {
          name: "price",
          type: "float",
          required: true,
          description: "Retail unit price",
        },
        {
          name: "stock",
          type: "integer",
          required: true,
          description: "Available inventory quantity",
        },
      ],
    },
    {
      name: "Order",
      label: "Purchase Order",
      color: "#8b5cf6",
      icon: "briefcase",
      description: "Customer cart purchase order",
      properties: [
        {
          name: "orderId",
          type: "string",
          required: true,
          description: "Order reference code",
        },
        {
          name: "orderDate",
          type: "datetime",
          required: true,
          description: "Order creation timestamp",
        },
        {
          name: "totalAmount",
          type: "float",
          required: true,
          description: "Final payable amount",
        },
        {
          name: "status",
          type: "string",
          required: true,
          description: "PLACED, FULFILLED, or CANCELLED",
        },
      ],
    },
  ],
  relationships: [
    {
      name: "PLACED_ORDER",
      label: "Placed Order",
      sourceEntity: "Shopper",
      targetEntity: "Order",
      cardinality: "ONE_TO_MANY",
      description: "Customer created this order",
    },
  ],
};
