import type { SystemCapability } from "./types";

export const DEFAULT_USER_NAME = "LuminAI Operator";
export const DEFAULT_USER_EMAIL = "admin@luminai.io";
export const DEFAULT_TENANT_SLUG = "lumin-global-prod";
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_ROLES = ["ADMIN", "DATA_ARCHITECT"];
export const MASKED_KEY_PLACEHOLDER = "••••••••••••••••••••••••••••••••";

export const SYSTEM_CAPABILITIES: SystemCapability[] = [
  {
    label: "Theme Palette",
    value: "OLED Dark (Tailwind v4)",
  },
  {
    label: "Cache Layer",
    value: "Redis (30s Dashboard / 60s Explorer)",
  },
  {
    label: "Event Bus",
    value: "Apache Kafka (Batch 100)",
  },
];
