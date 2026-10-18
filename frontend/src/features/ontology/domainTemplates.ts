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
  relationships?: Array<{
    name: string;
    label: string;
    sourceEntity: string;
    targetEntity: string;
    cardinality: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY";
    description: string;
  }>;
}

export const DOMAIN_STARTER_PACKS: DomainTemplate[] = [
  {
    id: "financial",
    domain: "Financial Services",
    name: "Core Banking & Transactions",
    badge: "Fintech",
    badgeColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/60",
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
  },
  {
    id: "healthcare",
    domain: "Healthcare",
    name: "Clinical & Hospital Care",
    badge: "Healthcare",
    badgeColor: "text-cyan-400 bg-cyan-950/60 border-cyan-800/60",
    description:
      "Standard clinical schema for patients, medical doctors, and patient encounters.",
    entityTypes: [
      {
        name: "Patient",
        label: "Patient",
        color: "#06b6d4",
        icon: "user",
        description: "Patient medical records and demographics",
        properties: [
          {
            name: "patientId",
            type: "string",
            required: true,
            description: "Medical record number (MRN)",
          },
          {
            name: "firstName",
            type: "string",
            required: true,
            description: "Patient first name",
          },
          {
            name: "lastName",
            type: "string",
            required: true,
            description: "Patient last name",
          },
          {
            name: "dateOfBirth",
            type: "date",
            required: false,
            description: "Date of birth",
          },
          {
            name: "gender",
            type: "string",
            required: false,
            description: "Biological sex or gender",
          },
          {
            name: "bloodType",
            type: "string",
            required: false,
            description: "ABO blood group",
          },
        ],
      },
      {
        name: "Doctor",
        label: "Physician",
        color: "#3b82f6",
        icon: "briefcase",
        description: "Licensed medical practitioners and specialists",
        properties: [
          {
            name: "doctorId",
            type: "string",
            required: true,
            description: "License or NPI number",
          },
          {
            name: "fullName",
            type: "string",
            required: true,
            description: "Doctor full title and name",
          },
          {
            name: "specialty",
            type: "string",
            required: true,
            description: "Medical specialty (Cardiology, etc.)",
          },
          {
            name: "department",
            type: "string",
            required: false,
            description: "Hospital department",
          },
        ],
      },
      {
        name: "Encounter",
        label: "Medical Encounter",
        color: "#f59e0b",
        icon: "package",
        description: "Clinical inpatient or outpatient visit",
        properties: [
          {
            name: "encounterId",
            type: "string",
            required: true,
            description: "Visit ID",
          },
          {
            name: "visitDate",
            type: "datetime",
            required: true,
            description: "Date/time of admission",
          },
          {
            name: "diagnosisCode",
            type: "string",
            required: false,
            description: "ICD-10 clinical diagnosis code",
          },
          {
            name: "encounterType",
            type: "string",
            required: true,
            description: "INPATIENT, OUTPATIENT, or EMERGENCY",
          },
        ],
      },
    ],
    relationships: [
      {
        name: "ATTENDED_BY",
        label: "Attended By",
        sourceEntity: "Encounter",
        targetEntity: "Doctor",
        cardinality: "MANY_TO_ONE",
        description: "Clinical encounter supervised by attending physician",
      },
      {
        name: "HAS_ENCOUNTER",
        label: "Has Encounter",
        sourceEntity: "Patient",
        targetEntity: "Encounter",
        cardinality: "ONE_TO_MANY",
        description: "Patient clinical admissions",
      },
    ],
  },
  {
    id: "ecommerce",
    domain: "E-Commerce",
    name: "Retail & Order Management",
    badge: "Retail",
    badgeColor: "text-amber-400 bg-amber-950/60 border-amber-800/60",
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
  },
  {
    id: "logistics",
    domain: "Supply Chain",
    name: "Fleet & Freight Operations",
    badge: "Logistics",
    badgeColor: "text-blue-400 bg-blue-950/60 border-blue-800/60",
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
  },
];
