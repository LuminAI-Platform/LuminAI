import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  Select,
  MultiSelect,
  ThemeMenu,
  ActionMenu,
  DropdownMenuRoot,
  DropdownMenuItem,
  DropdownMenuHeader,
  DropdownMenuSeparator,
} from "../components/ui/dropdown";

describe("Shared Dropdown & Menu Component Family", () => {
  describe("Select Component", () => {
    it("renders trigger with combobox role, placeholder, and chevron", () => {
      const html = renderToStaticMarkup(
        React.createElement(Select, {
          value: "",
          onChange: () => {},
          options: [
            { value: "pg", label: "PostgreSQL" },
            { value: "mysql", label: "MySQL" },
          ],
          placeholder: "Choose database...",
          ariaLabel: "Database Selector",
        }),
      );

      expect(html).toContain('role="combobox"');
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain("Choose database...");
      expect(html).toContain('aria-label="Database Selector"');
    });

    it("displays the selected option label when value matches an option", () => {
      const html = renderToStaticMarkup(
        React.createElement(Select, {
          value: "pg",
          onChange: () => {},
          options: [
            { value: "pg", label: "PostgreSQL" },
            { value: "mysql", label: "MySQL" },
          ],
        }),
      );

      expect(html).toContain("PostgreSQL");
      expect(html).not.toContain("Select an option…");
    });

    it("renders disabled state when disabled prop is passed", () => {
      const html = renderToStaticMarkup(
        React.createElement(Select, {
          value: "pg",
          onChange: () => {},
          disabled: true,
          options: [{ value: "pg", label: "PostgreSQL" }],
        }),
      );

      expect(html).toContain("disabled");
      expect(html).toContain("opacity-50");
    });
  });

  describe("MultiSelect Component", () => {
    it("renders trigger with label and count chip when items are selected", () => {
      const html = renderToStaticMarkup(
        React.createElement(MultiSelect, {
          label: "Status",
          values: ["RUNNING", "FAILED"],
          onChange: () => {},
          options: [
            { value: "RUNNING", label: "RUNNING", count: 2 },
            { value: "COMPLETED", label: "COMPLETED", count: 10 },
            { value: "FAILED", label: "FAILED", count: 1 },
          ],
        }),
      );

      expect(html).toContain("Status");
      expect(html).toContain('role="combobox"');
      // Count chip should show 2
      expect(html).toContain(">2<");
    });

    it("does not render count chip when no values are selected", () => {
      const html = renderToStaticMarkup(
        React.createElement(MultiSelect, {
          label: "Entity Types",
          values: [],
          onChange: () => {},
          placeholder: "All Types",
          options: [{ value: "Customer", label: "Customer" }],
        }),
      );

      expect(html).toContain("Entity Types");
      expect(html).toContain("All Types");
      expect(html).not.toContain("bg-primary-tint");
    });
  });

  describe("ThemeMenu Component", () => {
    it("renders theme switcher trigger with accessible label", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          RadixTooltip.Provider,
          null,
          React.createElement(ThemeMenu, {}),
        ),
      );
      expect(html).toContain('aria-label="Theme:');
      expect(html).toContain("<button");
    });
  });

  describe("ActionMenu Component", () => {
    it("renders action trigger button with menu role capability", () => {
      const html = renderToStaticMarkup(
        React.createElement(ActionMenu, {
          ariaLabel: "Row actions",
          items: [
            { label: "Edit", onClick: () => {} },
            { label: "Delete", destructive: true, onClick: () => {} },
          ],
        }),
      );

      expect(html).toContain('aria-label="Row actions"');
      expect(html).toContain('aria-haspopup="menu"');
    });
  });

  describe("DropdownMenu Header & Items Visual Spec", () => {
    it("renders user menu header with avatar initials, name, and email", () => {
      const html = renderToStaticMarkup(
        React.createElement(DropdownMenuHeader, {
          avatar: "AD",
          name: "Admin User",
          email: "admin@luminai.local",
        }),
      );

      expect(html).toContain("Admin User");
      expect(html).toContain("admin@luminai.local");
      expect(html).toContain("AD");
    });

    it("renders destructive item with error styling and divider", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          DropdownMenuRoot,
          null,
          React.createElement(DropdownMenuSeparator, {}),
          React.createElement(
            DropdownMenuItem,
            { destructive: true },
            "Sign out",
          ),
        ),
      );

      expect(html).toContain('role="separator"');
      expect(html).toContain('role="menuitem"');
      expect(html).toContain("text-error");
      expect(html).toContain("Sign out");
    });
  });
});
