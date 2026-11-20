import type { DomainTemplate } from "./types";

export const CYBER_TEMPLATE: DomainTemplate = {
  id: "cyber",
  domain: "Cybersecurity & IT",
  name: "Assets, Threats & Access Logs",
  badge: "Security",
  badgeColor: "text-error bg-error-bg border-error-border",
  description:
    "SOC operations schema for network hosts, incident tickets, and user access records.",
  entityTypes: [
    {
      name: "Host",
      label: "Host / Endpoint",
      color: "#ef4444",
      icon: "server",
      description: "Network host, server, or cloud VM instance",
      properties: [
        {
          name: "hostId",
          type: "string",
          required: true,
          description: "Internal asset ID",
        },
        {
          name: "hostname",
          type: "string",
          required: true,
          description: "FQDN or machine hostname",
        },
        {
          name: "ipAddress",
          type: "string",
          required: true,
          description: "Primary IPv4/IPv6 address",
        },
        {
          name: "os",
          type: "string",
          required: false,
          description: "Operating system & version",
        },
      ],
    },
    {
      name: "User",
      label: "Identity / User",
      color: "#8b5cf6",
      icon: "user",
      description: "Active Directory or IAM user principal",
      properties: [
        {
          name: "username",
          type: "string",
          required: true,
          description: "Login identity username",
        },
        {
          name: "email",
          type: "string",
          required: true,
          description: "Corporate email address",
        },
        {
          name: "fullName",
          type: "string",
          required: true,
          description: "Full name",
        },
        {
          name: "role",
          type: "string",
          required: false,
          description: "Job title or role",
        },
      ],
    },
  ],
};
