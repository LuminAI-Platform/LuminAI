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
  it("renders 'No entities yet' state when no query and no filters are present", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerEmptyState, {
        query: "",
        hasFilters: false,
      }),
    );

    expect(html).toContain("No entities yet");
    expect(html).toContain("Connect a data source");
    expect(html).toContain("/connections");
    expect(html).not.toContain("No entities match these filters");
  });

  it("renders 'No entities match these filters' state when query is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerEmptyState, {
        query: "acme corp",
        hasFilters: false,
        onClearFilters: () => {},
      }),
    );

    expect(html).toContain("No entities match these filters");
    expect(html).toContain("Clear filters");
    expect(html).not.toContain("No entities yet");
  });

  it("renders 'No entities match these filters' state when filter is active without search text", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExplorerEmptyState, {
        query: "",
        hasFilters: true,
        onClearFilters: () => {},
      }),
    );

    expect(html).toContain("No entities match these filters");
    expect(html).toContain("Clear filters");
  });
});
