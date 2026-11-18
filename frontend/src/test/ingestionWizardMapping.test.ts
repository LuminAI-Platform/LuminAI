import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StepIngesting } from "../features/connections/components/file-upload/StepIngesting";
import { StepMapping } from "../features/connections/components/file-upload/StepMapping";
import type { ColumnConfig } from "../features/connections/components/DataPreviewTable";
import type { ColumnMappingConfig } from "../features/connections/components/file-upload/fileUploadTypes";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children?: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href: to, className }, children),
}));

describe("Ingestion Wizard - StepIngesting Single Entity Type Warning", () => {
  const dummyFile = {
    name: "patients.csv",
    size: 20480,
  } as unknown as File;

  const columnsConfig: ColumnConfig[] = [
    { name: "id", type: "String", active: true },
    { name: "name", type: "String", active: true },
    { name: "physician", type: "String", active: true },
    { name: "insurer", type: "String", active: true },
    { name: "diagnosis", type: "String", active: true },
  ];

  it("shows single-type warning when all active columns are mapped to 'Person'", () => {
    const singleMappings: Record<string, ColumnMappingConfig> = {
      id: {
        targetEntityType: "Person",
        targetProperty: "id",
        transformation: "NONE",
      },
      name: {
        targetEntityType: "Person",
        targetProperty: "name",
        transformation: "NONE",
      },
      physician: {
        targetEntityType: "Person",
        targetProperty: "physician",
        transformation: "NONE",
      },
      insurer: {
        targetEntityType: "Person",
        targetProperty: "insurer",
        transformation: "NONE",
      },
      diagnosis: {
        targetEntityType: "Person",
        targetProperty: "diagnosis",
        transformation: "NONE",
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(StepIngesting, {
        file: dummyFile,
        parsedRowsCount: 57,
        columnsConfig,
        mappings: singleMappings,
        ingesting: false,
        ingestionProgress: 0,
        ingestionLogs: [],
        ingestedCount: 0,
        ingestionFinished: false,
        ingestionFailed: false,
        errorMessage: null,
        startIngestion: vi.fn(),
      }),
    );

    // Verifies warning banner presence
    expect(html).toContain("Single Entity Type Mapping Notice");
    expect(html).toContain(
      "All records were mapped to <strong>Person</strong>. Columns such as physician, insurer and diagnosis were stored as properties, not entities.",
    );
  });

  it("does not show single-type warning when active columns are mapped across multiple entity types", () => {
    const multiMappings: Record<string, ColumnMappingConfig> = {
      id: {
        targetEntityType: "Patient",
        targetProperty: "id",
        transformation: "NONE",
      },
      name: {
        targetEntityType: "Patient",
        targetProperty: "name",
        transformation: "NONE",
      },
      physician: {
        targetEntityType: "Physician",
        targetProperty: "name",
        transformation: "NONE",
      },
      insurer: {
        targetEntityType: "Insurer",
        targetProperty: "name",
        transformation: "NONE",
      },
      diagnosis: {
        targetEntityType: "Diagnosis",
        targetProperty: "code",
        transformation: "NONE",
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(StepIngesting, {
        file: dummyFile,
        parsedRowsCount: 57,
        columnsConfig,
        mappings: multiMappings,
        ingesting: false,
        ingestionProgress: 0,
        ingestionLogs: [],
        ingestedCount: 0,
        ingestionFinished: false,
        ingestionFailed: false,
        errorMessage: null,
        startIngestion: vi.fn(),
      }),
    );

    expect(html).not.toContain("Single Entity Type Mapping Notice");
  });
});

describe("Ingestion Wizard - StepMapping Entity Preview", () => {
  const dummyFile = {
    name: "patients.csv",
    size: 20480,
  } as unknown as File;

  const columnsConfig: ColumnConfig[] = [
    { name: "id", type: "String", active: true },
    { name: "physician", type: "String", active: true },
  ];

  it("shows preview summary when 1 entity type is configured", () => {
    const mappings: Record<string, ColumnMappingConfig> = {
      id: {
        targetEntityType: "Person",
        targetProperty: "id",
        transformation: "NONE",
      },
      physician: {
        targetEntityType: "Person",
        targetProperty: "physician",
        transformation: "NONE",
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(StepMapping, {
        file: dummyFile,
        columnsConfig,
        mappings,
        ontologyEntityTypes: ["Person", "Physician", "Insurer"],
        primaryTargetEntity: "Person",
        inferredEntityName: "Person",
        isCreatingCustomEntity: false,
        customEntityInput: "",
        ontologyProperties: {},
        setIsCreatingCustomEntity: vi.fn(),
        setCustomEntityInput: vi.fn(),
        toggleColumn: vi.fn(),
        updateColumnType: vi.fn(),
        handlePrimaryEntityChange: vi.fn(),
        handleApplyCustomEntity: vi.fn(),
        updateMapping: vi.fn(),
      }),
    );

    expect(html).toContain("1 type will be created");
    expect(html).toContain(
      "Tip: Assign columns to different entity types below to generate multiple classes.",
    );
  });

  it("shows preview summary when multiple entity types are configured", () => {
    const mappings: Record<string, ColumnMappingConfig> = {
      id: {
        targetEntityType: "Patient",
        targetProperty: "id",
        transformation: "NONE",
      },
      physician: {
        targetEntityType: "Physician",
        targetProperty: "physician",
        transformation: "NONE",
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(StepMapping, {
        file: dummyFile,
        columnsConfig,
        mappings,
        ontologyEntityTypes: ["Patient", "Physician", "Insurer"],
        primaryTargetEntity: "Patient",
        inferredEntityName: "Patient",
        isCreatingCustomEntity: false,
        customEntityInput: "",
        ontologyProperties: {},
        setIsCreatingCustomEntity: vi.fn(),
        setCustomEntityInput: vi.fn(),
        toggleColumn: vi.fn(),
        updateColumnType: vi.fn(),
        handlePrimaryEntityChange: vi.fn(),
        handleApplyCustomEntity: vi.fn(),
        updateMapping: vi.fn(),
      }),
    );

    expect(html).toContain("2 types will be created");
    expect(html).toContain("Patient");
    expect(html).toContain("Physician");
  });
});
