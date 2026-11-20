import type { DomainTemplate } from "./types";

export const IOT_TEMPLATE: DomainTemplate = {
  id: "iot",
  domain: "IoT & Manufacturing",
  name: "Devices, Sensors & Telemetry",
  badge: "Hardware",
  badgeColor: "text-warning bg-warning-bg border-warning-border",
  description:
    "Fleet devices, equipment serial numbers, and machine telemetry metrics.",
  entityTypes: [
    {
      name: "Device",
      label: "Device",
      color: "#f59e0b",
      icon: "cpu",
      description: "Industrial controllers, edge gateways, or smart meters",
      properties: [
        {
          name: "deviceId",
          type: "string",
          required: true,
          description: "Hardware device ID",
        },
        {
          name: "deviceModel",
          type: "string",
          required: true,
          description: "Model name or number",
        },
        {
          name: "serialNumber",
          type: "string",
          required: false,
          description: "Serial number",
        },
        {
          name: "status",
          type: "string",
          required: false,
          description: "Status (e.g. Active, In Repair)",
        },
      ],
    },
  ],
};
