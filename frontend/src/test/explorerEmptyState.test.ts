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

import { ExplorerEmptyState } from "../pages/explorer/components/ExplorerEmptyState";

describe("ExplorerEmptyState Component", () => {
  it("renders 'No records yet' state when no query and no filters are present", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerEmptyState, {
        query: "",
        hasFilters: false,
      }),
    );

    expect(html.includes("No records yet")).toBe(true);
    expect(
      html.includes("Connect a data source to start matching records."),
    ).toBe(true);
    expect(html.includes("Connect a source")).toBe(true);
    expect(html.includes("/connections")).toBe(true);
    // Short note on what appears
    expect(
      html.includes(
        "Once data is connected, this explorer displays resolved record names, entity types, and data source connections.",
      ),
    ).toBe(true);
    // No confusion icons or search copy
    expect(html.includes("No results for")).toBe(false);
  });

  it("renders 'Search with no match' state when query is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerEmptyState, {
        query: "acme corp",
        hasFilters: false,
        onClearFilters: () => {},
      }),
    );

    expect(html.includes("No results for ‘acme corp’")).toBe(true);
    expect(html.includes("Try different words or clear filters.")).toBe(true);
    expect(html.includes("Clear filters")).toBe(true);
    expect(
      html.includes(
        "Entity Explorer searches across canonical record names, entity types, unified properties, and data sources.",
      ),
    ).toBe(true);
    expect(html.includes("No records yet")).toBe(false);
  });

  it("renders 'Search with no match' state when filter is active without search text", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerEmptyState, {
        query: "",
        hasFilters: true,
        onClearFilters: () => {},
      }),
    );

    expect(html.includes("No results for selected filters")).toBe(true);
    expect(html.includes("Try different words or clear filters.")).toBe(true);
    expect(html.includes("Clear filters")).toBe(true);
  });
});
