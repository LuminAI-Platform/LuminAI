import type { DomainTemplate } from "./types";

export const HEALTHCARE_TEMPLATE: DomainTemplate = {
  id: "healthcare",
  domain: "Healthcare",
  name: "Clinical & Hospital Care",
  badge: "Healthcare",
  badgeColor: "text-primary bg-primary-tint border-primary-border",
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
};
