import React, { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  History,
  Layers,
  Plus,
  Sparkles,
  Database,
  Check,
  X,
  Loader2,
  AlertCircle,
  FolderDown,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  VisualSchemaMapper,
  type SourceColumn,
  type OntologyProperty,
  type SchemaMappingPayload,
} from "../../features/connections/components/VisualSchemaMapper";
import {
  EntityTypeEditor,
  type EntityType,
} from "../../features/ontology/components/EntityTypeEditor";

// ─── Ready-to-Use Industry Templates ──────────────────────────────────────────

interface DomainTemplate {
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

const DOMAIN_STARTER_PACKS: DomainTemplate[] = [
  {
    id: "healthcare",
    domain: "Healthcare",
    name: "Hospital & Clinics",
    badge: "Healthcare",
    badgeColor: "text-cyan-400 bg-cyan-950/60 border-cyan-800/60",
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
            required: false,
            description: "Date of birth",
          },
          {
            name: "gender",
            type: "string",
            required: false,
            description: "Gender",
          },
          {
            name: "bloodType",
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
        ],
      },
      {
        name: "Doctor",
        label: "Doctor",
        color: "#3b82f6",
        icon: "briefcase",
        description: "Doctors and medical staff",
        properties: [
          {
            name: "doctorId",
            type: "string",
            required: true,
            description: "Doctor license or ID",
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
            required: false,
            description: "Medical field or specialty",
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
        name: "Visit",
        label: "Visit",
        color: "#10b981",
        icon: "clipboard",
        description: "Patient checkups and appointments",
        properties: [
          {
            name: "visitId",
            type: "string",
            required: true,
            description: "Visit ID",
          },
          {
            name: "patientId",
            type: "string",
            required: true,
            description: "Patient ID",
          },
          {
            name: "doctorId",
            type: "string",
            required: false,
            description: "Doctor ID",
          },
          {
            name: "visitDate",
            type: "date",
            required: true,
            description: "Date of visit",
          },
          {
            name: "diagnosis",
            type: "string",
            required: false,
            description: "Doctor's diagnosis",
          },
          {
            name: "visitType",
            type: "string",
            required: false,
            description: "Type of visit (e.g. Inpatient, Outpatient)",
          },
        ],
      },
    ],
  },
  {
    id: "education",
    domain: "Education",
    name: "Schools & Universities",
    badge: "Education",
    badgeColor: "text-purple-400 bg-purple-950/60 border-purple-800/60",
    description: "Standard tables for students, courses, and grades.",
    entityTypes: [
      {
        name: "Student",
        label: "Student",
        color: "#8b5cf6",
        icon: "user",
        description: "Enrolled student records",
        properties: [
          {
            name: "studentId",
            type: "string",
            required: true,
            description: "Student ID number",
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
            name: "email",
            type: "string",
            required: false,
            description: "School email address",
          },
          {
            name: "gradeLevel",
            type: "string",
            required: false,
            description: "Class or grade year",
          },
          {
            name: "gpa",
            type: "number",
            required: false,
            description: "Grade point average",
          },
          {
            name: "enrollmentDate",
            type: "date",
            required: false,
            description: "Enrollment date",
          },
        ],
      },
      {
        name: "Course",
        label: "Course",
        color: "#f59e0b",
        icon: "package",
        description: "Classes and subjects taught",
        properties: [
          {
            name: "courseId",
            type: "string",
            required: true,
            description: "Course code (e.g. CS101)",
          },
          {
            name: "courseName",
            type: "string",
            required: true,
            description: "Course title",
          },
          {
            name: "department",
            type: "string",
            required: false,
            description: "Department or subject area",
          },
          {
            name: "credits",
            type: "number",
            required: false,
            description: "Course credits",
          },
          {
            name: "teacherName",
            type: "string",
            required: false,
            description: "Teacher or professor name",
          },
        ],
      },
      {
        name: "Enrollment",
        label: "Enrollment",
        color: "#ec4899",
        icon: "clipboard",
        description: "Student class signups and grades",
        properties: [
          {
            name: "enrollmentId",
            type: "string",
            required: true,
            description: "Enrollment ID",
          },
          {
            name: "studentId",
            type: "string",
            required: true,
            description: "Student ID",
          },
          {
            name: "courseId",
            type: "string",
            required: true,
            description: "Course code",
          },
          {
            name: "semester",
            type: "string",
            required: false,
            description: "Semester (e.g. Fall 2026)",
          },
          {
            name: "finalGrade",
            type: "string",
            required: false,
            description: "Final grade",
          },
        ],
      },
    ],
  },
  {
    id: "commerce",
    domain: "Retail",
    name: "Retail & Stores",
    badge: "Retail",
    badgeColor: "text-blue-400 bg-blue-950/60 border-blue-800/60",
    description: "Standard tables for customers, orders, and products.",
    entityTypes: [
      {
        name: "Customer",
        label: "Customer",
        color: "#06b6d4",
        icon: "user",
        description: "Buyer and customer accounts",
        properties: [
          {
            name: "customerId",
            type: "string",
            required: true,
            description: "Customer ID",
          },
          {
            name: "customerName",
            type: "string",
            required: true,
            description: "Customer full name",
          },
          {
            name: "email",
            type: "string",
            required: false,
            description: "Email address",
          },
          {
            name: "city",
            type: "string",
            required: false,
            description: "City",
          },
          {
            name: "country",
            type: "string",
            required: false,
            description: "Country",
          },
        ],
      },
      {
        name: "Order",
        label: "Order",
        color: "#3b82f6",
        icon: "package",
        description: "Sales transactions and purchases",
        properties: [
          {
            name: "orderId",
            type: "string",
            required: true,
            description: "Order number",
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
            description: "Date of order",
          },
          {
            name: "totalAmount",
            type: "number",
            required: true,
            description: "Total order price",
          },
          {
            name: "orderStatus",
            type: "string",
            required: false,
            description: "Order status (e.g. Shipped, Paid)",
          },
        ],
      },
      {
        name: "Product",
        label: "Product",
        color: "#10b981",
        icon: "target",
        description: "Items and goods for sale",
        properties: [
          {
            name: "productId",
            type: "string",
            required: true,
            description: "Product SKU or ID",
          },
          {
            name: "productName",
            type: "string",
            required: true,
            description: "Product name",
          },
          {
            name: "category",
            type: "string",
            required: false,
            description: "Item category",
          },
          {
            name: "unitPrice",
            type: "number",
            required: false,
            description: "Price per item",
          },
        ],
      },
    ],
  },
  {
    id: "logistics",
    domain: "Logistics",
    name: "Shipping & Delivery",
    badge: "Logistics",
    badgeColor: "text-amber-400 bg-amber-950/60 border-amber-800/60",
    description: "Standard tables for packages, shipments, and warehouses.",
    entityTypes: [
      {
        name: "Shipment",
        label: "Shipment",
        color: "#f97316",
        icon: "briefcase",
        description: "Package deliveries and tracking",
        properties: [
          {
            name: "trackingNumber",
            type: "string",
            required: true,
            description: "Tracking number",
          },
          {
            name: "carrier",
            type: "string",
            required: false,
            description: "Delivery company",
          },
          {
            name: "origin",
            type: "string",
            required: false,
            description: "Shipped from",
          },
          {
            name: "destination",
            type: "string",
            required: false,
            description: "Shipped to",
          },
          {
            name: "status",
            type: "string",
            required: false,
            description: "Status (e.g. In Transit, Delivered)",
          },
          {
            name: "shippedDate",
            type: "date",
            required: false,
            description: "Ship date",
          },
        ],
      },
      {
        name: "Warehouse",
        label: "Warehouse",
        color: "#f59e0b",
        icon: "building",
        description: "Storage depots and fulfillment centers",
        properties: [
          {
            name: "warehouseId",
            type: "string",
            required: true,
            description: "Warehouse code",
          },
          {
            name: "warehouseName",
            type: "string",
            required: true,
            description: "Warehouse location name",
          },
          {
            name: "capacity",
            type: "number",
            required: false,
            description: "Storage capacity",
          },
          {
            name: "country",
            type: "string",
            required: false,
            description: "Country",
          },
        ],
      },
    ],
  },
  {
    id: "business",
    domain: "Business",
    name: "Companies & Staff",
    badge: "Business",
    badgeColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/60",
    description: "Standard tables for companies, employees, and office assets.",
    entityTypes: [
      {
        name: "Company",
        label: "Company",
        color: "#10b981",
        icon: "building",
        description: "Company accounts and organizations",
        properties: [
          {
            name: "companyId",
            type: "string",
            required: true,
            description: "Company ID",
          },
          {
            name: "companyName",
            type: "string",
            required: true,
            description: "Company name",
          },
          {
            name: "industry",
            type: "string",
            required: false,
            description: "Industry",
          },
          {
            name: "website",
            type: "string",
            required: false,
            description: "Website URL",
          },
          {
            name: "country",
            type: "string",
            required: false,
            description: "Country",
          },
        ],
      },
      {
        name: "Employee",
        label: "Employee",
        color: "#3b82f6",
        icon: "user",
        description: "Staff and team members",
        properties: [
          {
            name: "employeeId",
            type: "string",
            required: true,
            description: "Employee ID",
          },
          {
            name: "fullName",
            type: "string",
            required: true,
            description: "Full name",
          },
          {
            name: "email",
            type: "string",
            required: false,
            description: "Work email",
          },
          {
            name: "jobTitle",
            type: "string",
            required: false,
            description: "Job title",
          },
          {
            name: "department",
            type: "string",
            required: false,
            description: "Department",
          },
        ],
      },
      {
        name: "Asset",
        label: "Equipment",
        color: "#6366f1",
        icon: "package",
        description: "Office equipment and inventory",
        properties: [
          {
            name: "assetId",
            type: "string",
            required: true,
            description: "Asset or barcode ID",
          },
          {
            name: "assetName",
            type: "string",
            required: true,
            description: "Item name",
          },
          {
            name: "assetType",
            type: "string",
            required: false,
            description: "Item category (e.g. Laptop, Vehicle)",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseEntityProperties(t: {
  name: string;
  label?: string;
  properties?: Array<{
    name: string;
    type?: string;
    dataType?: string;
    required?: boolean;
    description?: string;
  }>;
  propertiesSchema?: string | Record<string, unknown>;
}): OntologyProperty[] {
  if (Array.isArray(t.properties) && t.properties.length > 0) {
    return t.properties.map((p, idx) => ({
      id: p.name || `p_${idx}`,
      name: p.name,
      entityClass: t.name,
      expectedType: p.dataType || p.type || "string",
      required: Boolean(p.required),
      description: p.description || p.name,
    }));
  }

  if (t.propertiesSchema) {
    try {
      const parsed =
        typeof t.propertiesSchema === "string"
          ? JSON.parse(t.propertiesSchema)
          : t.propertiesSchema;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as Record<string, unknown>).properties
      ) {
        const schemaProps = (
          parsed as {
            properties: Record<
              string,
              { type?: string; description?: string; default?: unknown }
            >;
          }
        ).properties;
        const requiredList = Array.isArray(
          (parsed as { required?: string[] }).required,
        )
          ? ((parsed as { required: string[] }).required as string[])
          : [];

        const props = Object.entries(schemaProps).map(([pName, pDef]) => ({
          id: pName,
          name: pName,
          entityClass: t.name,
          expectedType: pDef?.type || "string",
          required: requiredList.includes(pName),
          description: pDef?.description || pName,
        }));

        if (props.length > 0) {
          return props;
        }
      }
    } catch {
      // ignore
    }
  }

  return [
    {
      id: "id",
      name: "id",
      entityClass: t.name,
      expectedType: "string",
      required: true,
      description: "ID",
    },
    {
      id: "name",
      name: "name",
      entityClass: t.name,
      expectedType: "string",
      required: true,
      description: "Name",
    },
  ];
}

function sanitizeEntityName(rawName: string): string {
  if (!rawName) return "CustomEntity";
  let cleaned = rawName.split(".").pop() || rawName;
  cleaned = cleaned.replace(/(_csv|_xlsx|_json)$/i, "");
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  if (!/^[a-zA-Z]/.test(pascal)) {
    pascal = "Entity_" + pascal;
  }
  if (pascal.length < 2) {
    pascal = pascal + "_Record";
  }
  return pascal;
}

function sanitizePropertyName(rawName: string): string {
  if (!rawName) return "field";
  const words = rawName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "field";
  let camel = words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  if (!/^[a-zA-Z]/.test(camel)) {
    camel = "col_" + camel;
  }
  return camel;
}

function inferPropertyType(colType?: string): string {
  if (!colType) return "string";
  const lower = colType.toLowerCase();
  if (
    lower.includes("int") ||
    lower.includes("decimal") ||
    lower.includes("float") ||
    lower.includes("double") ||
    lower.includes("num")
  ) {
    return "number";
  }
  if (lower.includes("date") || lower.includes("time")) {
    return "date";
  }
  if (lower.includes("bool")) {
    return "boolean";
  }
  if (
    lower.includes("json") ||
    lower.includes("object") ||
    lower.includes("array")
  ) {
    return "json";
  }
  return "string";
}

// ─── Main Schema Mapping Page ─────────────────────────────────────────────────

export const SchemaMapPage: React.FC = () => {
  const [sources, setSources] = useState<
    Record<string, { table: string; columns: SourceColumn[] }>
  >({});
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedOntology, setSelectedOntology] = useState<string>("");
  const [savedMappings, setSavedMappings] = useState<SchemaMappingPayload[]>(
    [],
  );
  const [showHistory, setShowHistory] = useState(false);

  // Real database entity types fetched from backend
  const [dynamicOntologyMap, setDynamicOntologyMap] = useState<
    Record<string, OntologyProperty[]>
  >({});
  const [dynamicOntologyLabels, setDynamicOntologyLabels] = useState<
    Record<string, string>
  >({});
  const [loadingOntology, setLoadingOntology] = useState(true);

  // Dialog and Action States
  const [isEntityEditorOpen, setIsEntityEditorOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [generatingFromDataset, setGeneratingFromDataset] = useState(false);
  const [seedingDomain, setSeedingDomain] = useState<string | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch real connectors from backend GET /api/v1/connections
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await apiFetch("/api/v1/connections");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const newSources: Record<
              string,
              { table: string; columns: SourceColumn[] }
            > = {};
            const newLabels: Record<string, string> = {};
            list.forEach(
              (c: {
                id: string;
                name: string;
                type: string;
                config?: string | Record<string, unknown>;
              }) => {
                let parsedConfig: Record<string, unknown> = {};
                if (typeof c.config === "string") {
                  try {
                    parsedConfig = JSON.parse(c.config);
                  } catch {
                    // ignore
                  }
                } else if (c.config && typeof c.config === "object") {
                  parsedConfig = c.config as Record<string, unknown>;
                }

                // If multi-table archive bundle:
                if (
                  Array.isArray(parsedConfig.tables) &&
                  parsedConfig.tables.length > 0
                ) {
                  parsedConfig.tables.forEach(
                    (
                      tbl: {
                        fileName?: string;
                        columns?: string[];
                        sampleRows?: Record<string, unknown>[];
                      },
                      tIdx: number,
                    ) => {
                      const tblName = tbl.fileName || `table_${tIdx + 1}`;
                      const subKey = `conn_${c.id}_${tblName}`;
                      newLabels[subKey] = `${c.name} > ${tblName}`;

                      const cols: SourceColumn[] = [];
                      const colNames = Array.isArray(tbl.columns)
                        ? tbl.columns
                        : [];
                      const sampleRow =
                        Array.isArray(tbl.sampleRows) && tbl.sampleRows[0]
                          ? tbl.sampleRows[0]
                          : {};

                      colNames.forEach((colName: string, cIdx: number) => {
                        const val = sampleRow[colName];
                        let dType: SourceColumn["dataType"] = "string";
                        if (typeof val === "number") {
                          dType = Number.isInteger(val) ? "integer" : "float";
                        } else if (typeof val === "boolean") {
                          dType = "boolean";
                        } else if (typeof val === "string") {
                          if (
                            !isNaN(Date.parse(val)) &&
                            (val.includes("-") || val.includes("/"))
                          ) {
                            dType = "timestamp";
                          }
                        }
                        cols.push({
                          id: `col_${cIdx + 1}`,
                          name: colName,
                          dataType: dType,
                          sample:
                            val !== undefined && val !== null
                              ? String(val)
                              : "—",
                          nullable: true,
                        });
                      });

                      if (cols.length === 0) return;

                      newSources[subKey] = {
                        table: `${c.name}.${tblName}`,
                        columns: cols,
                      };
                    },
                  );
                  return;
                }

                // Single dataset file or database connector
                const key = `conn_${c.id}`;
                newLabels[key] = `${c.name} (${c.type})`;

                const cols: SourceColumn[] = [];
                const colNames = Array.isArray(parsedConfig.columns)
                  ? (parsedConfig.columns as string[])
                  : [];
                const sampleRow =
                  Array.isArray(parsedConfig.sampleRows) &&
                  parsedConfig.sampleRows[0]
                    ? (parsedConfig.sampleRows[0] as Record<string, unknown>)
                    : {};

                colNames.forEach((colName: string, cIdx: number) => {
                  const val = sampleRow[colName];
                  let dType: SourceColumn["dataType"] = "string";
                  if (typeof val === "number") {
                    dType = Number.isInteger(val) ? "integer" : "float";
                  } else if (typeof val === "boolean") {
                    dType = "boolean";
                  } else if (typeof val === "string") {
                    if (
                      !isNaN(Date.parse(val)) &&
                      (val.includes("-") || val.includes("/"))
                    ) {
                      dType = "timestamp";
                    }
                  }
                  cols.push({
                    id: `col_${cIdx + 1}`,
                    name: colName,
                    dataType: dType,
                    sample:
                      val !== undefined && val !== null ? String(val) : "—",
                    nullable: true,
                  });
                });

                newSources[key] = {
                  table: `${c.type}.${c.name.replace(/\s+/g, "_").toUpperCase()}`,
                  columns: cols,
                };
              },
            );
            setSources(newSources);
            setSourceLabels(newLabels);

            const preferredId =
              new URLSearchParams(window.location.search).get("connectionId") ||
              localStorage.getItem("lumin_selected_connection_id");

            if (preferredId) {
              const matchKey = Object.keys(newSources).find((k) =>
                k.includes(preferredId),
              );
              if (matchKey) {
                setSelectedSource(matchKey);
              } else if (list.length > 0) {
                setSelectedSource(`conn_${list[0].id}`);
              }
              localStorage.removeItem("lumin_selected_connection_id");
            } else if (list.length > 0) {
              setSelectedSource(`conn_${list[0].id}`);
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    };
    fetchConnections();
  }, []);

  // Fetch real entity types from backend API GET /api/v1/ontology/entity-types
  const fetchOntologyTypes = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/entity-types");
      if (res.ok) {
        const types = await res.json();
        if (Array.isArray(types) && types.length > 0) {
          const newMap: Record<string, OntologyProperty[]> = {};
          const newLabels: Record<string, string> = {};

          types.forEach(
            (t: {
              id?: string;
              name: string;
              label?: string;
              properties?: Array<{
                name: string;
                dataType?: string;
                type?: string;
                required?: boolean;
                description?: string;
              }>;
              propertiesSchema?: string | Record<string, unknown>;
            }) => {
              newLabels[t.name] = t.label || t.name;
              newMap[t.name] = parseEntityProperties(t);
            },
          );

          setDynamicOntologyMap(newMap);
          setDynamicOntologyLabels(newLabels);

          setSelectedOntology((prev) =>
            prev && newMap[prev] ? prev : types[0]?.name || "",
          );
        } else {
          setDynamicOntologyMap({});
          setDynamicOntologyLabels({});
          setSelectedOntology("");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch ontology types", err);
    } finally {
      setLoadingOntology(false);
    }
  }, []);

  useEffect(() => {
    fetchOntologyTypes();
  }, [fetchOntologyTypes]);

  // Fetch saved mappings from GET /api/v1/schema-mappings
  useEffect(() => {
    const fetchSavedMappings = async () => {
      try {
        const res = await apiFetch("/api/v1/schema-mappings");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const normalised: SchemaMappingPayload[] = list.map(
              (item: Record<string, unknown>) => {
                if (item.sourceTable && item.mappings) {
                  return item as unknown as SchemaMappingPayload;
                }
                return {
                  connectionId: String(
                    item.connectorId ?? item.connectionId ?? "",
                  ),
                  sourceTable: String(
                    item.name ?? item.sourceColumn ?? "source_table",
                  ),
                  targetEntity: String(
                    item.targetEntityType ?? item.targetEntity ?? "Entity",
                  ),
                  mappings: [
                    {
                      sourceColumnId: String(item.sourceColumn ?? ""),
                      ontologyPropertyId: String(item.targetProperty ?? ""),
                    },
                  ],
                  createdAt: String(item.createdAt ?? new Date().toISOString()),
                };
              },
            );
            setSavedMappings(normalised);
          }
        }
      } catch {
        // Saved mappings unavailable
      }
    };
    fetchSavedMappings();
  }, []);

  const handleSave = (payload: SchemaMappingPayload) => {
    setSavedMappings((prev) => [payload, ...prev.slice(0, 4)]);
  };

  const sourceData = sources[selectedSource] || { table: "", columns: [] };
  const activeOntologyKey =
    selectedOntology && dynamicOntologyMap[selectedOntology]
      ? selectedOntology
      : Object.keys(dynamicOntologyMap)[0] || "";
  const ontologyProps = dynamicOntologyMap[activeOntologyKey] ?? [];

  // ─── Auto-Create Entity in Database from Data Columns ───────────────────────
  const handleAutoGenerateFromDataset = async () => {
    if (!sourceData.columns || sourceData.columns.length === 0) {
      setToast({
        message: "Please select a data source with columns first.",
        type: "error",
      });
      return;
    }

    setGeneratingFromDataset(true);
    try {
      const rawTable = sourceData.table || "NewEntity";
      const entityName = sanitizeEntityName(rawTable);
      const displayLabel = entityName.replace(/([A-Z])/g, " $1").trim();

      const properties = sourceData.columns.map((col) => ({
        name: sanitizePropertyName(col.name),
        type: inferPropertyType(col.dataType),
        required:
          col.nullable === false ||
          col.name.toLowerCase().endsWith("id") ||
          col.name.toLowerCase() === "id",
        defaultValue: null,
        description: col.name,
      }));

      const res = await apiFetch("/api/v1/ontology/entity-types", {
        method: "POST",
        body: JSON.stringify({
          name: entityName,
          label: displayLabel,
          color: "#3b82f6",
          icon: "database",
          description: `Created from ${rawTable}`,
          properties,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Failed to create entity`);
      }

      const created = await res.json();
      await fetchOntologyTypes();
      setSelectedOntology(created.name || entityName);
      setToast({
        message: `Created '${created.name || entityName}' with ${properties.length} fields.`,
        type: "success",
      });
    } catch (err: unknown) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to create entity.",
        type: "error",
      });
    } finally {
      setGeneratingFromDataset(false);
    }
  };

  // ─── Add Industry Template to Database ──────────────────────────────────────
  const handleSeedDomainTemplate = async (template: DomainTemplate) => {
    setSeedingDomain(template.id);
    try {
      let createdCount = 0;
      for (const et of template.entityTypes) {
        try {
          const res = await apiFetch("/api/v1/ontology/entity-types", {
            method: "POST",
            body: JSON.stringify(et),
          });
          if (res.ok) {
            createdCount++;
          }
        } catch {
          // Skip if entity already exists
        }
      }

      await fetchOntologyTypes();
      if (template.entityTypes.length > 0) {
        setSelectedOntology(template.entityTypes[0].name);
      }
      setIsSeedModalOpen(false);
      setToast({
        message: `Added ${template.name} (${createdCount} entities) to your database.`,
        type: "success",
      });
    } catch (err: unknown) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to add templates.",
        type: "error",
      });
    } finally {
      setSeedingDomain(null);
    }
  };

  // ─── Custom Entity Created Callback ─────────────────────────────────────────
  const handleEntitySaved = async (saved: EntityType) => {
    await fetchOntologyTypes();
    setSelectedOntology(saved.name);
    setIsEntityEditorOpen(false);
    setToast({
      message: `Created '${saved.label || saved.name}' successfully.`,
      type: "success",
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page Header */}
      <div className="mb-4 shrink-0">
        <PageHeader
          breadcrumbs={[
            { label: "Data Integration", to: "/connections" },
            { label: "Schema Mapping" },
          ]}
          title="Schema Mapping"
          description="Map columns from your data source to your database entities."
          icon={<Layers className="w-5 h-5 text-blue-400" />}
          badge={{
            label: "Live Database",
            variant: "blue",
          }}
          actions={
            <div className="flex items-center gap-2">
              <button
                id="schema-map-starter-packs"
                onClick={() => setIsSeedModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:text-indigo-100 hover:bg-indigo-900/60 transition-all cursor-pointer"
                title="Add ready-made templates for Healthcare, Schools, Retail, or Shipping"
              >
                <FolderDown className="w-3.5 h-3.5 text-indigo-400" />
                <span>Industry Templates</span>
              </button>

              <button
                id="schema-map-new-entity"
                onClick={() => setIsEntityEditorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:text-emerald-100 hover:bg-emerald-900/60 transition-all cursor-pointer"
                title="Create a new custom entity"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>New Entity</span>
              </button>

              <button
                id="schema-map-history-toggle"
                onClick={() => setShowHistory((h) => !h)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-all cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>Saved Mappings ({savedMappings.length})</span>
              </button>
            </div>
          }
        />
      </div>

      {/* ── Selectors ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 shrink-0 select-none">
        {/* Source selector */}
        <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Source Table
            </p>
            {sourceData.columns.length > 0 && (
              <span className="text-[10px] text-zinc-400 font-mono">
                {sourceData.columns.length} columns found
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(sourceLabels).length === 0 ? (
              <span className="text-xs text-zinc-500 py-1">
                No data sources found. Please upload a file or connect a
                database first.
              </span>
            ) : (
              Object.keys(sourceLabels).map((key) => (
                <button
                  key={key}
                  id={`source-select-${key}`}
                  onClick={() => setSelectedSource(key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                    selectedSource === key
                      ? "bg-blue-600 border-blue-500/40 text-white shadow-lg shadow-blue-500/15"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {sourceLabels[key]}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Target Entity Selector */}
        <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                Target Entity
              </p>
              {loadingOntology && (
                <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {sourceData.columns.length > 0 && (
                <button
                  type="button"
                  id="auto-generate-entity-btn"
                  onClick={handleAutoGenerateFromDataset}
                  disabled={generatingFromDataset}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Create an entity automatically using the columns from your data"
                >
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>
                    {generatingFromDataset ? "Creating…" : "Create from Data"}
                  </span>
                </button>
              )}

              <Link
                to="/ontology"
                className="text-[10px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                title="Go to Entity Manager to see all tables"
              >
                <Plus className="w-3 h-3" />
                <span>Entity Manager</span>
              </Link>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {loadingOntology ? (
              <span className="text-xs text-zinc-500 py-1">
                Loading entities from database…
              </span>
            ) : Object.keys(dynamicOntologyLabels).length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-amber-400/90 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>No entities in your database yet.</span>
                </span>
                <button
                  onClick={handleAutoGenerateFromDataset}
                  disabled={
                    generatingFromDataset || sourceData.columns.length === 0
                  }
                  className="px-2.5 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  Create from Data
                </button>
                <button
                  onClick={() => setIsSeedModalOpen(true)}
                  className="px-2.5 py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors cursor-pointer"
                >
                  Pick Template
                </button>
              </div>
            ) : (
              Object.keys(dynamicOntologyLabels).map((key) => (
                <button
                  key={key}
                  id={`ontology-select-${key}`}
                  onClick={() => setSelectedOntology(key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                    selectedOntology === key ||
                    (!selectedOntology &&
                      key === Object.keys(dynamicOntologyLabels)[0])
                      ? "bg-emerald-600 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/15"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {dynamicOntologyLabels[key]}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Mapping History Drawer ── */}
      {showHistory && (
        <div className="mb-4 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex-shrink-0">
          <p className="text-xs font-semibold text-zinc-300 mb-3">
            Saved Mappings
          </p>
          {savedMappings.length === 0 ? (
            <p className="text-[11px] text-zinc-600">
              No saved mappings yet. Connect your columns and click Save
              Mapping.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {savedMappings.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-400">
                      {(m.sourceTable ?? "table").split(".").pop()}
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-zinc-700"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span className="font-mono text-emerald-400">
                      {m.targetEntity ?? "Entity"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-600">
                    <span>
                      {m.mappings?.length ?? 1} column
                      {(m.mappings?.length ?? 1) === 1 ? "" : "s"} mapped
                    </span>
                    <span>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString()
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mapper Canvas ── */}
      <div className="flex-1 min-h-0 bg-zinc-950/80 border border-zinc-800/80 rounded-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-dots opacity-60 pointer-events-none" />
        <div className="relative h-full">
          {Object.keys(dynamicOntologyLabels).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 z-10 relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/5">
                <Database className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-1.5">
                No Entities Found in Your Database
              </h3>
              <p className="text-xs text-zinc-400 max-w-lg mb-6 leading-relaxed">
                To map your data, you need at least one entity in your database.
                Choose how you want to add one:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl text-left">
                {/* 1. Auto-generate from dataset */}
                <div
                  onClick={
                    sourceData.columns.length > 0 && !generatingFromDataset
                      ? handleAutoGenerateFromDataset
                      : undefined
                  }
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    sourceData.columns.length > 0
                      ? "bg-zinc-900/80 border-blue-500/30 hover:border-blue-500/60 hover:bg-zinc-900 cursor-pointer shadow-lg shadow-blue-500/5"
                      : "bg-zinc-900/30 border-zinc-800/60 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-bold text-zinc-100">
                        Create from Data
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Automatically create a new entity using the columns from
                      your uploaded data.
                    </p>
                  </div>
                  <button
                    disabled={
                      sourceData.columns.length === 0 || generatingFromDataset
                    }
                    className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {generatingFromDataset ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {generatingFromDataset ? "Creating…" : "Create from Data"}
                    </span>
                  </button>
                </div>

                {/* 2. Industry Starter Pack */}
                <div
                  onClick={() => setIsSeedModalOpen(true)}
                  className="p-4 rounded-xl bg-zinc-900/80 border border-indigo-500/30 hover:border-indigo-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between shadow-lg shadow-indigo-500/5"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-indigo-400">
                      <FolderDown className="w-4 h-4" />
                      <span className="text-xs font-bold text-zinc-100">
                        Use a Template
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Add ready-made tables for hospitals, schools, stores, or
                      shipping.
                    </p>
                  </div>
                  <button className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>View Templates</span>
                  </button>
                </div>

                {/* 3. Custom Entity */}
                <div
                  onClick={() => setIsEntityEditorOpen(true)}
                  className="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between shadow-lg shadow-emerald-500/5"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <Plus className="w-4 h-4" />
                      <span className="text-xs font-bold text-zinc-100">
                        Create Custom
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Build a custom entity and type in your own fields
                      manually.
                    </p>
                  </div>
                  <button className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Entity</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <VisualSchemaMapper
              key={`${selectedSource}-${activeOntologyKey}`}
              connectionId={selectedSource}
              sourceTable={sourceData.table}
              sourceColumns={sourceData.columns}
              ontologyProperties={ontologyProps}
              availableEntities={Object.keys(dynamicOntologyLabels)}
              onSave={handleSave}
            />
          )}
        </div>
      </div>

      {/* ── Template Picker Modal ── */}
      {isSeedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <FolderDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    Starter Templates
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Add standard tables directly to your database with one click
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSeedModalOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DOMAIN_STARTER_PACKS.map((pack) => {
                  const isSeedingThis = seedingDomain === pack.id;
                  return (
                    <div
                      key={pack.id}
                      className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pack.badgeColor}`}
                          >
                            {pack.badge}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {pack.entityTypes.length} Tables
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">
                          {pack.name}
                        </h4>
                        <p className="text-xs text-zinc-400 mt-1 mb-4 leading-relaxed">
                          {pack.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {pack.entityTypes.map((et) => (
                            <span
                              key={et.name}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300"
                            >
                              {et.name}{" "}
                              <span className="text-zinc-500">
                                ({et.properties.length} fields)
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSeedDomainTemplate(pack)}
                        disabled={seedingDomain !== null}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSeedingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Adding to database…</span>
                          </>
                        ) : (
                          <>
                            <Database className="w-3.5 h-3.5" />
                            <span>Add {pack.domain} Tables</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-500">
              <span>
                All added entities are saved to your account. You can edit them
                anytime in the Entity Manager.
              </span>
              <button
                onClick={() => setIsSeedModalOpen(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Entity Type Editor Modal ── */}
      {isEntityEditorOpen && (
        <EntityTypeEditor
          onClose={() => setIsEntityEditorOpen(false)}
          onSaved={handleEntitySaved}
        />
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50"
              : toast.type === "error"
                ? "bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50"
                : "bg-blue-950/90 border-blue-500/40 text-blue-200 shadow-blue-950/50"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <Database className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="text-xs font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-zinc-400 hover:text-zinc-100 p-0.5 rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
