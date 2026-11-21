import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

import { getEntityTypeIcon, pickKeyCardFields } from "../pages/explorer/utils";
import { EntityCard } from "../features/explorer/components/EntityCard";
import { FacetFilterSidebar } from "../features/explorer/components/FacetFilterSidebar";
import { ExplorerErrorState } from "../pages/explorer/components/ExplorerSearchStates";

describe("Entity Presentation & Components", () => {
  it("assigns distinct icons for different entity types", () => {
    const personIcon = getEntityTypeIcon("Person");
    const orgIcon = getEntityTypeIcon("Organization");
    const insurerIcon = getEntityTypeIcon("Insurer");
    const datasetIcon = getEntityTypeIcon("Dataset");

    expect(personIcon).not.toBe(orgIcon);
    expect(orgIcon).not.toBe(insurerIcon);
    expect(insurerIcon).not.toBe(datasetIcon);
  });

  it("picks 3 to 4 key fields per entity type", () => {
    const fields = pickKeyCardFields(
      "Person",
      {
        email: "alice@example.com",
        dob: "1990-01-01",
        phone: "555-1234",
        country: "US",
        extra1: "foo",
        extra2: "bar",
      },
      "2026-04-01T00:00:00Z",
      4,
    );

    expect(fields).toHaveLength(4);
    expect(fields.map((f) => f.key)).toEqual([
      "email",
      "dob",
      "phone",
      "country",
    ]);
  });

  it("EntityCard masks sensitive fields by default and omits missing API fields", () => {
    const html = renderToStaticMarkup(
      React.createElement(EntityCard, {
        entity: {
          id: "11111111-2222-3333-4444-555555555555",
          canonicalName: "Alice Johnson",
          entityType: "Person",
          properties: {
            email: "alice@corp.com",
            date_of_birth: "1985-05-12",
            country: "US",
          },
          confidenceScore: 0.95,
          sourceCount: 2,
        },
        maskSensitiveData: true,
        onSelect: () => {},
      }),
    );

    expect(html).toContain("a***@corp.com");
    expect(html).toContain("19**-**-**");
    expect(html).not.toContain("alice@corp.com");
    expect(html).not.toContain("1985-05-12");
    expect(html).toContain("Merged from 2 records");
    expect(html).toContain("95%");
    expect(html).toContain("Reveal");
    // Missing fields must NOT appear
    expect(html).not.toContain("Why merged?");
    expect(html).not.toContain("Possible duplicate");
  });

  it("FacetFilterSidebar hides 0-count types by default behind toggle and sorts descending", () => {
    const html = renderToStaticMarkup(
      React.createElement(FacetFilterSidebar, {
        selectedTypes: [],
        onChange: () => {},
        facets: { Person: 40, Organization: 20 },
        ontologyTypes: [
          {
            id: "1",
            name: "Organization",
            label: "Organization",
            description: "",
            color: "#56B4E9",
            icon: "building",
            properties: [],
          },
          {
            id: "2",
            name: "Person",
            label: "Person",
            description: "",
            color: "#12297A",
            icon: "user",
            properties: [],
          },
          {
            id: "3",
            name: "Customers100000",
            label: "Customers100000",
            description: "",
            color: "#009E73",
            icon: "package",
            properties: [],
          },
          {
            id: "4",
            name: "Diabetes Large Dataset",
            label: "Diabetes Large Dataset",
            description: "",
            color: "#C26E00",
            icon: "package",
            properties: [],
          },
        ],
      }),
    );

    // Person (40) should appear before Organization (20)
    expect(html.indexOf("Person")).toBeLessThan(html.indexOf("Organization"));
    // Empty types hidden behind toggle
    expect(html).toContain("Show empty types (2)");
    expect(html).not.toContain("Customers100000");
    // Real checkboxes
    expect(html).toContain('type="checkbox"');
  });

  it("ExplorerErrorState renders error title, Retry button, and Details toggle", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerErrorState, {
        error: "Couldn't load entities",
        details: "HTTP 503 Service Unavailable",
        onRetry: () => {},
      }),
    );

    expect(html).toContain("Couldn&#x27;t load entities");
    expect(html).toContain("Retry");
    expect(html).toContain("Details");
    // Details collapsed by default
    expect(html).not.toContain("HTTP 503 Service Unavailable");
  });
});
