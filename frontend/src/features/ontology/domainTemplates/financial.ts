import type { DomainTemplate } from "./types";

export const FINANCIAL_TEMPLATE: DomainTemplate = {
  id: "financial",
  domain: "Financial Services",
  name: "Core Banking & Transactions",
  badge: "Fintech",
  badgeColor: "text-success bg-success-bg border-success-border",
  description:
    "Enterprise model for customers, bank accounts, transactions, and merchants.",
  entityTypes: [
    {
      name: "Customer",
      label: "Customer",
      color: "#10b981",
      icon: "user",
      description: "Banking individual or corporate client entity",
      properties: [
        {
          name: "customerId",
          type: "string",
          required: true,
          description: "Unique customer identifier",
        },
        {
          name: "firstName",
          type: "string",
          required: true,
          description: "Customer legal first name",
        },
        {
          name: "lastName",
          type: "string",
          required: true,
          description: "Customer legal last name",
        },
        {
          name: "email",
          type: "string",
          required: true,
          description: "Primary contact email address",
        },
        {
          name: "riskRating",
          type: "string",
          required: false,
          description: "KYC risk assessment tier (LOW, MEDIUM, HIGH)",
        },
        {
          name: "country",
          type: "string",
          required: false,
          description: "Tax residency country ISO code",
        },
      ],
    },
    {
      name: "Account",
      label: "Bank Account",
      color: "#3b82f6",
      icon: "building",
      description: "Deposit, checking, or credit account",
      properties: [
        {
          name: "accountId",
          type: "string",
          required: true,
          description: "Account identifier",
        },
        {
          name: "accountNumber",
          type: "string",
          required: true,
          description: "IBAN or domestic account number",
        },
        {
          name: "accountType",
          type: "string",
          required: true,
          description: "CHECKING, SAVINGS, or LOAN",
        },
        {
          name: "balance",
          type: "float",
          required: true,
          description: "Current ledger balance",
        },
        {
          name: "currency",
          type: "string",
          required: true,
          description: "ISO-4217 Currency code",
        },
        {
          name: "status",
          type: "string",
          required: true,
          description: "ACTIVE, DORMANT, or CLOSED",
        },
      ],
    },
    {
      name: "Transaction",
      label: "Transaction",
      color: "#8b5cf6",
      icon: "chart",
      description: "Financial monetary transfer or card payment event",
      properties: [
        {
          name: "transactionId",
          type: "string",
          required: true,
          description: "Transaction reference ID",
        },
        {
          name: "amount",
          type: "float",
          required: true,
          description: "Transaction value",
        },
        {
          name: "currency",
          type: "string",
          required: true,
          description: "ISO currency",
        },
        {
          name: "transactionType",
          type: "string",
          required: true,
          description: "WIRE, ACH, POS, or ATM",
        },
        {
          name: "timestamp",
          type: "datetime",
          required: true,
          description: "Booking timestamp",
        },
      ],
    },
  ],
  relationships: [
    {
      name: "OWNS_ACCOUNT",
      label: "Owns Account",
      sourceEntity: "Customer",
      targetEntity: "Account",
      cardinality: "ONE_TO_MANY",
      description: "Customer holds or operates this account",
    },
    {
      name: "RECORDED_ON",
      label: "Recorded On",
      sourceEntity: "Transaction",
      targetEntity: "Account",
      cardinality: "MANY_TO_ONE",
      description: "Transaction posted against target account",
    },
  ],
};
