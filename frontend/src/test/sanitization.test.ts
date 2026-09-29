import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../lib/sanitize";

describe("Stored & Reflected XSS Sanitization (SEC-01 / CF-04)", () => {
  it("should strip dangerous script payloads from highlight snippets", () => {
    const maliciousInput = 'Entity <script>alert("xss")</script> Name';
    const sanitized = sanitizeHtml(maliciousInput);

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("alert");
  });

  it("should strip img and svg event handlers (onerror, onload)", () => {
    const maliciousImg = 'Test <img src=x onerror="alert(document.cookie)"> Corporation';
    const sanitizedImg = sanitizeHtml(maliciousImg);
    expect(sanitizedImg).not.toContain("<img");
    expect(sanitizedImg).not.toContain("onerror");

    const maliciousSvg = 'Test <svg onload="fetch(\'/steal\')"> Node';
    const sanitizedSvg = sanitizeHtml(maliciousSvg);
    expect(sanitizedSvg).not.toContain("<svg");
    expect(sanitizedSvg).not.toContain("onload");
  });

  it("should preserve harmless highlight tags (em, b, strong)", () => {
    const validHighlight = "Acme <em>Corporation</em> Golden <strong>Record</strong>";
    const sanitized = sanitizeHtml(validHighlight);

    expect(sanitized).toContain("<em>Corporation</em>");
    expect(sanitized).toContain("<strong>Record</strong>");
  });
});
