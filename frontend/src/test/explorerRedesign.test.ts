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

import {
  isSensitiveField,
  maskSensitiveValue,
  parseSearchQuery,
  removeFilterFromQuery,
  normalizeSearchResponse,
  getEntityTypeIcon,
  pickKeyCardFields,
} from "../pages/explorer/utils";
import { EntityCard } from "../features/explorer/components/EntityCard";
import { FacetFilterSidebar } from "../features/explorer/components/FacetFilterSidebar";
import { ExplorerErrorState } from "../pages/explorer/components/ExplorerSearchStates";
import { buildApiFilterParams } from "../pages/explorer/hooks/explorerSearchHelpers";

describe("Privacy Masking Utilities", () => {
  it("masks email, DOB, phone, salary, and ID fields by field name", () => {
    expect(isSensitiveField("email")).toBe(true);
    expect(isSensitiveField("date_of_birth")).toBe(true);
    expect(isSensitiveField("phone_number")).toBe(true);
    expect(isSensitiveField("annual_salary")).toBe(true);
    expect(isSensitiveField("insurance_id")).toBe(true);
    expect(isSensitiveField("ssn")).toBe(true);
    expect(isSensitiveField("country")).toBe(false);

    expect(maskSensitiveValue("email", "bob.smith@corp.com", true)).toBe(
      "b***@corp.com",
    );
    expect(maskSensitiveValue("date_of_birth", "1984-07-22", true)).toBe(
      "19**-**-**",
    );
    expect(maskSensitiveValue("phone", "+1-555-0199", true)).toBe("••••••");
    expect(maskSensitiveValue("salary", 125000, true)).toBe("••••••");
    expect(maskSensitiveValue("insurance_id", "INS-998877", true)).toBe(
      "••••••",
    );
    expect(maskSensitiveValue("country", "US", true)).toBe("US");
  });

  it("reveals values when masked is false", () => {
    expect(maskSensitiveValue("email", "bob.smith@corp.com", false)).toBe(
      "bob.smith@corp.com",
    );
    expect(maskSensitiveValue("date_of_birth", "1984-07-22", false)).toBe(
      "1984-07-22",
    );
  });
});

describe("Search Query Parsing & Response Normalization", () => {
  it("extracts field:value filters and removes chips cleanly", () => {
    const parsed = parseSearchQuery('jane country:US type:"Hospital Patient"');
    expect(parsed.text).toBe("jane");
    expect(parsed.filters).toHaveLength(2);
    expect(parsed.filters[0]).toMatchObject({ key: "country", value: "US" });
    expect(parsed.filters[1]).toMatchObject({
      key: "type",
      value: "Hospital Patient",
    });

    const afterRemove = removeFilterFromQuery(
      'jane country:US type:"Hospital Patient"',
      parsed.filters[0],
    );
    expect(afterRemove).toBe('jane type:"Hospital Patient"');
  });

  it("preserves API-returned fields without fabricating missing ones", () => {
    const res = normalizeSearchResponse(
      {
        items: [
          {
            id: "11111111-2222-3333-4444-555555555555",
            canonicalName: "Jane Doe",
            entityType: "Person",
            confidenceScore: 0.92,
            sourceCount: 3,
            properties: { email: "jane@corp.com" },
            createdAt: "2026-04-01T10:00:00Z",
            updatedAt: "2026-04-02T10:00:00Z",
          },
          {
            id: "22222222-3333-4444-5555-666666666666",
            canonicalName: "Minimal Entity",
            entityType: "Organization",
            properties: {},
          },
        ],
        total: 2,
        page: 0,
        size: 12,
        facets: { entityTypes: { Person: 1, Organization: 1 } },
      },
      12,
      0,
    );

    expect(res.content[0].confidenceScore).toBe(0.92);
    expect(res.content[0].sourceCount).toBe(3);
    expect(res.content[0].updatedAt).toBe("2026-04-02T10:00:00Z");

    // Second item did not have confidenceScore, sourceCount, or insights -> must stay undefined
    expect(res.content[1].confidenceScore).toBeUndefined();
    expect(res.content[1].sourceCount).toBeUndefined();
    expect(res.content[1].possibleDuplicate).toBeUndefined();
    expect(res.content[1].matchReasons).toBeUndefined();
    expect(res.insights).toBeUndefined();
  });

  it("maps insight filter tokens to boolean API params and preserves field:value filters", () => {
    const res = buildApiFilterParams(
      "alice duplicates:true missing:true review:true email:alice@corp.com type:Person",
      [],
    );
    expect(res.apiQuery).toBe("alice email:alice@corp.com");
    expect(res.effectiveTypes).toEqual(["Person"]);
    expect(res.duplicates).toBe(true);
    expect(res.missing).toBe(true);
    expect(res.review).toBe(true);
  });

  it("normalizes boolean possibleDuplicate from backend SearchItem", () => {
    const res = normalizeSearchResponse(
      {
        items: [
          {
            id: "dup-1",
            canonicalName: "Bob Smith",
            entityType: "Person",
            possibleDuplicate: true,
            properties: {},
          },
        ],
        total: 1,
        page: 0,
        size: 12,
        facets: {},
      },
      12,
      0,
    );
    expect(res.content[0].possibleDuplicate).toEqual({
      name: "another record",
    });
  });
});

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
