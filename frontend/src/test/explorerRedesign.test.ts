import { describe, it, expect } from "vitest";
import {
  isSensitiveField,
  maskSensitiveValue,
  parseSearchQuery,
  removeFilterFromQuery,
  normalizeSearchResponse,
} from "../pages/explorer/utils";

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
});
