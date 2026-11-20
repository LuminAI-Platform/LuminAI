import type { DomainTemplate } from "./types";
import { FINANCIAL_TEMPLATE } from "./financial";
import { HEALTHCARE_TEMPLATE } from "./healthcare";
import { ECOMMERCE_TEMPLATE } from "./ecommerce";
import { LOGISTICS_TEMPLATE } from "./logistics";
import { CYBER_TEMPLATE } from "./cyber";
import { IOT_TEMPLATE } from "./iot";

export * from "./types";
export { FINANCIAL_TEMPLATE } from "./financial";
export { HEALTHCARE_TEMPLATE } from "./healthcare";
export { ECOMMERCE_TEMPLATE } from "./ecommerce";
export { LOGISTICS_TEMPLATE } from "./logistics";
export { CYBER_TEMPLATE } from "./cyber";
export { IOT_TEMPLATE } from "./iot";

export const DOMAIN_STARTER_PACKS: DomainTemplate[] = [
  FINANCIAL_TEMPLATE,
  HEALTHCARE_TEMPLATE,
  ECOMMERCE_TEMPLATE,
  LOGISTICS_TEMPLATE,
  CYBER_TEMPLATE,
  IOT_TEMPLATE,
];
