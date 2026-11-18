import type { SystemCapability } from "./types";

export const DEFAULT_USER_NAME = "Unknown User";
export const DEFAULT_USER_EMAIL = "No email provided";
export const DEFAULT_TENANT_SLUG = "default";
export const DEFAULT_TENANT_ID = "—";
export const DEFAULT_ROLES = ["USER"];
export const MASKED_KEY_PLACEHOLDER = "••••••••••••••••••••••••••••••••";

export const SYSTEM_CAPABILITIES: SystemCapability[] = [
  {
    label: "Theme Palette",
    value: "Adaptive (Light / Dark / System)",
  },
  {
    label: "Cache Layer",
    value: "Distributed In-Memory Cache",
  },
  {
    label: "Event Bus",
    value: "Stream Processing Bus",
  },
];
