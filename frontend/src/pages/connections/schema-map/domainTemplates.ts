export interface DomainTemplate {
  id: string;
  domain: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  entityTypes: Array<{
    name: string;
    label: string;
    color: string;
    icon: string;
    description: string;
    properties: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
    }>;
  }>;
}

export const DOMAIN_STARTER_PACKS: DomainTemplate[] = [
  {
    id: "healthcare",
    domain: "Healthcare",
    name: "Hospital & Clinics",
    badge: "Healthcare",
    badgeColor: "text-primary bg-primary-tint border-primary-border",
    description: "Standard tables for patients, doctors, and hospital visits.",
    entityTypes: [
      {
        name: "Patient",
        label: "Patient",
        color: "#06b6d4",
        icon: "user",
        description: "Patient records and personal information",
        properties: [
          {
            name: "patientId",
            type: "string",
            required: true,
            description: "Patient ID number",
          },
          {
            name: "firstName",
            type: "string",
            required: true,
            description: "First name",
          },
          {
            name: "lastName",
            type: "string",
            required: true,
            description: "Last name",
          },
          {
            name: "dateOfBirth",
            type: "date",
            required: true,
            description: "Date of birth",
          },
          {
            name: "bloodGroup",
            type: "string",
            required: false,
            description: "Blood group",
          },
          {
            name: "phone",
            type: "string",
            required: false,
            description: "Contact phone number",
          },
          {
            name: "email",
            type: "string",
            required: false,
            description: "Contact email",
          },
          {
            name: "emergencyContact",
            type: "string",
            required: false,
            description: "Emergency contact person",
          },
        ],
      },
      {
        name: "Doctor",
        label: "Doctor",
        color: "#3b82f6",
        icon: "user-check",
        description: "Physicians, specialists, and clinical staff",
        properties: [
          {
            name: "doctorId",
            type: "string",
            required: true,
            description: "Doctor ID number",
          },
          {
            name: "fullName",
            type: "string",
            required: true,
            description: "Full name",
          },
          {
            name: "specialty",
            type: "string",
            required: true,
            description: "Medical specialty",
          },
          {
            name: "department",
            type: "string",
            required: true,
            description: "Hospital department",
          },
          {
            name: "licenseNumber",
            type: "string",
            required: true,
            description: "Medical license number",
          },
          {
            name: "phone",
            type: "string",
            required: false,
            description: "Phone extension or number",
          },
        ],
      },
      {
        name: "Encounter",
        label: "Hospital Visit",
        color: "#10b981",
        icon: "activity",
        description:
          "Outpatient or inpatient visits, consultations, and emergency admissions",
        properties: [
          {
            name: "encounterId",
            type: "string",
            required: true,
            description: "Encounter ID",
          },
          {
            name: "patientId",
            type: "string",
            required: true,
            description: "Reference to Patient ID",
          },
          {
            name: "doctorId",
            type: "string",
            required: true,
            description: "Attending Doctor ID",
          },
          {
            name: "admissionDate",
            type: "date",
            required: true,
            description: "Admission or consultation date",
          },
          {
            name: "dischargeDate",
            type: "date",
            required: false,
            description: "Discharge date",
          },
          {
            name: "diagnosisCode",
            type: "string",
            required: false,
            description: "Diagnosis code",
          },
          {
            name: "roomNumber",
            type: "string",
            required: false,
            description: "Room or clinic room number",
          },
        ],
      },
    ],
  },
  {
    id: "finance",
    domain: "Banking & Fintech",
    name: "Core Banking & Transactions",
    badge: "Finance",
    badgeColor: "text-success bg-success-bg border-success-border",
    description: "Accounts, transactions, customers, and wire transfers.",
    entityTypes: [
      {
        name: "BankAccount",
        label: "Bank Account",
        color: "#10b981",
        icon: "credit-card",
        description: "Checking, savings, or commercial bank account",
        properties: [
          {
            name: "accountId",
            type: "string",
            required: true,
            description: "Account number or ID",
          },
          {
            name: "customerId",
            type: "string",
            required: true,
            description: "Account holder customer ID",
          },
          {
            name: "accountType",
            type: "string",
            required: true,
            description: "Checking, Savings, Loan",
          },
          {
            name: "balance",
            type: "number",
            required: true,
            description: "Current ledger balance",
          },
          {
            name: "currency",
            type: "string",
            required: true,
            description: "ISO Currency code",
          },
          {
            name: "status",
            type: "string",
            required: true,
            description: "Status (e.g. Active, Suspended)",
          },
        ],
      },
      {
        name: "Transaction",
        label: "Transaction",
        color: "#f59e0b",
        icon: "arrow-left-right",
        description: "Financial transactions, wires, deposits, and card swipes",
        properties: [
          {
            name: "txId",
            type: "string",
            required: true,
            description: "Transaction ID",
          },
          {
            name: "sourceAccountId",
            type: "string",
            required: true,
            description: "Debited account ID",
          },
          {
            name: "destAccountId",
            type: "string",
            required: false,
            description: "Credited account ID",
          },
          {
            name: "amount",
            type: "number",
            required: true,
            description: "Transaction amount",
          },
          {
            name: "currency",
            type: "string",
            required: true,
            description: "ISO Currency code",
          },
          {
            name: "timestamp",
            type: "date",
            required: true,
            description: "Transaction timestamp",
          },
          {
            name: "channel",
            type: "string",
            required: false,
            description: "Channel (e.g. ATM, Mobile, Wire)",
          },
        ],
      },
      {
        name: "Customer",
        label: "Bank Customer",
        color: "#3b82f6",
        icon: "user",
        description: "Retail or corporate banking customer",
        properties: [
          {
            name: "customerId",
            type: "string",
            required: true,
            description: "Customer ID",
          },
          {
            name: "legalName",
            type: "string",
            required: true,
            description: "Legal name",
          },
          {
            name: "taxIdentifier",
            type: "string",
            required: true,
            description: "Tax identifier / SSN / EIN",
          },
          {
            name: "kycStatus",
            type: "string",
            required: true,
            description: "KYC Verification status",
          },
          {
            name: "country",
            type: "string",
            required: true,
            description: "Country code",
          },
        ],
      },
    ],
  },
  {
    id: "ecommerce",
    domain: "E-Commerce",
    name: "Store, Catalog & Fulfillment",
    badge: "Commerce",
    badgeColor: "text-primary bg-primary-tint border-primary-border",
    description:
      "Orders, order line items, product catalogs, and shipping logistics.",
    entityTypes: [
      {
        name: "Order",
        label: "Order",
        color: "#8b5cf6",
        icon: "shopping-bag",
        description: "Online purchases, billing, and fulfillment tracking",
        properties: [
          {
            name: "orderId",
            type: "string",
            required: true,
            description: "Order ID",
          },
          {
            name: "customerId",
            type: "string",
            required: true,
            description: "Customer ID",
          },
          {
            name: "orderDate",
            type: "date",
            required: true,
            description: "Purchase timestamp",
          },
          {
            name: "totalAmount",
            type: "number",
            required: true,
            description: "Total price paid",
          },
          {
            name: "paymentStatus",
            type: "string",
            required: true,
            description: "Payment status",
          },
          {
            name: "shippingStatus",
            type: "string",
            required: true,
            description: "Fulfillment status",
          },
        ],
      },
      {
        name: "Product",
        label: "Product",
        color: "#ec4899",
        icon: "box",
        description: "Store catalog items and inventory SKUs",
        properties: [
          {
            name: "sku",
            type: "string",
            required: true,
            description: "Stock keeping unit",
          },
          {
            name: "title",
            type: "string",
            required: true,
            description: "Product name",
          },
          {
            name: "unitPrice",
            type: "number",
            required: true,
            description: "Retail price",
          },
          {
            name: "stockQuantity",
            type: "number",
            required: true,
            description: "Available inventory quantity",
          },
          {
            name: "category",
            type: "string",
            required: false,
            description: "Product category",
          },
        ],
      },
    ],
  },
  {
    id: "saas",
    domain: "SaaS & CRM",
    name: "Customer Accounts & Subscriptions",
    badge: "SaaS",
    badgeColor: "text-primary bg-primary-tint border-primary-border",
    description:
      "Companies, contacts, deals, and recurring subscription licenses.",
    entityTypes: [
      {
        name: "Company",
        label: "Organization / Company",
        color: "#3b82f6",
        icon: "building-2",
        description: "B2B client organizations and tenant accounts",
        properties: [
          {
            name: "companyId",
            type: "string",
            required: true,
            description: "Company ID",
          },
          {
            name: "name",
            type: "string",
            required: true,
            description: "Company name",
          },
          {
            name: "domain",
            type: "string",
            required: false,
            description: "Website domain",
          },
          {
            name: "plan",
            type: "string",
            required: true,
            description: "Tier / Subscription plan",
          },
          {
            name: "mrr",
            type: "number",
            required: false,
            description: "Monthly recurring revenue",
          },
        ],
      },
      {
        name: "Contact",
        label: "Contact",
        color: "#0ea5e9",
        icon: "user",
        description: "Key account executives and platform users",
        properties: [
          {
            name: "contactId",
            type: "string",
            required: true,
            description: "Contact ID",
          },
          {
            name: "companyId",
            type: "string",
            required: true,
            description: "Organization ID",
          },
          {
            name: "email",
            type: "string",
            required: true,
            description: "Corporate email",
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
  },
  {
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
  },
];
