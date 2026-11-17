import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  useEnvironmentStore,
  getInitialEnvironment,
  STORAGE_KEY,
} from "../stores/environmentStore";
import { EnvironmentSwitcher } from "../components/layout/EnvironmentSwitcher";

describe("Environment Store & Configurations", () => {
  beforeEach(() => {
    localStorage.clear();
    useEnvironmentStore.getState().setEnvironment("production");
  });

  it("defaults to production with danger/colored badge styling", () => {
    expect(useEnvironmentStore.getState().environment).toBe("production");
    const config = useEnvironmentStore.getState().config;
    expect(config.label).toBe("Production");
    expect(config.isProduction).toBe(true);
    expect(config.dotClass).toContain("bg-error");
    expect(config.footerTextClass).toBe("text-error");
  });

  it("updates environment and persists to localStorage", () => {
    useEnvironmentStore.getState().setEnvironment("staging");
    expect(useEnvironmentStore.getState().environment).toBe("staging");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("staging");
    expect(useEnvironmentStore.getState().config.label).toBe("Staging");
    expect(useEnvironmentStore.getState().config.isProduction).toBe(false);

    useEnvironmentStore.getState().setEnvironment("development");
    expect(useEnvironmentStore.getState().environment).toBe("development");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("development");
  });

  it("getInitialEnvironment retrieves persisted environment", () => {
    localStorage.setItem(STORAGE_KEY, "staging");
    expect(getInitialEnvironment()).toBe("staging");

    localStorage.setItem(STORAGE_KEY, "development");
    expect(getInitialEnvironment()).toBe("development");

    localStorage.setItem(STORAGE_KEY, "production");
    expect(getInitialEnvironment()).toBe("production");
  });
});

describe("EnvironmentSwitcher Component Render", () => {
  it("renders a colored badge and LIVE tag when in production", () => {
    const html = renderToStaticMarkup(
      React.createElement(EnvironmentSwitcher, {
        environmentOverride: "production",
      }),
    );

    expect(html.includes("Production")).toBe(true);
    expect(html.includes("LIVE")).toBe(true);
    expect(html.includes("text-error")).toBe(true);
    expect(html.includes("bg-error")).toBe(true);
    expect(html.includes('id="environment-switcher-btn"')).toBe(true);
  });

  it("renders neutral styling when switched to staging or development", () => {
    const stagingHtml = renderToStaticMarkup(
      React.createElement(EnvironmentSwitcher, {
        environmentOverride: "staging",
      }),
    );
    expect(stagingHtml.includes("Staging")).toBe(true);
    expect(stagingHtml.includes("LIVE")).toBe(false);
    expect(stagingHtml.includes("text-error")).toBe(false);

    const devHtml = renderToStaticMarkup(
      React.createElement(EnvironmentSwitcher, {
        environmentOverride: "development",
      }),
    );
    expect(devHtml.includes("Development")).toBe(true);
    expect(devHtml.includes("LIVE")).toBe(false);
    expect(devHtml.includes("text-error")).toBe(false);
  });
});
