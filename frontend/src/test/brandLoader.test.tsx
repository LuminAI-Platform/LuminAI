import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import indexHtml from "../../index.html?raw";
import { BrandLoader, RouteLoader } from "../components/ui/BrandLoader";
import {
  BRAND_LOGO_LIGHT_BG,
  BRAND_LOGO_DARK_BG,
} from "../components/ui/brandLoaderUtils";
import { useThemeStore } from "../stores/themeStore";

describe("BrandLoader", () => {
  beforeEach(() => {
    useThemeStore.setState({
      theme: "light",
      resolvedTheme: "light",
      isDark: false,
    });
  });

  it("renders the ring variant with three rotating arcs, ~60% logo size, alt='', and status label", () => {
    const html = renderToStaticMarkup(
      React.createElement(BrandLoader, {
        variant: "ring",
        size: 100,
        label: "Loading Pipeline Monitor",
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Loading Pipeline Monitor");
    expect(html).toContain(`src="${BRAND_LOGO_LIGHT_BG}"`);
    expect(html).toContain('alt=""');
    expect(html).toContain('width="60"');
    expect(html).toContain('height="60"');
    expect(html).toContain("brand-loader-arc-1");
    expect(html).toContain("brand-loader-arc-2");
    expect(html).toContain("brand-loader-arc-3");
    expect(html).toContain("brand-loader-pulse");
  });

  it("renders the shine variant at 150px with base and sweeping overlay copies", () => {
    const html = renderToStaticMarkup(
      React.createElement(BrandLoader, {
        variant: "shine",
        statusText: "Loading LuminAI",
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Loading LuminAI");
    expect(html).toContain('width="150"');
    expect(html).toContain('height="150"');
    expect(html).toContain("brand-loader-shine-base");
    expect(html).toContain("brand-loader-shine-overlay");
  });

  it("renders the inline variant with small ring and ~55% logo inside", () => {
    const html = renderToStaticMarkup(
      React.createElement(BrandLoader, {
        variant: "inline",
        size: 20,
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("brand-loader-inline-ring");
    expect(html).toContain('width="11"');
    expect(html).toContain('height="11"');
    expect(html).toContain('alt=""');
  });

  it("switches to the light logo variant in dark mode with no white tile box", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().isDark).toBe(true);

    const html = renderToStaticMarkup(
      React.createElement(BrandLoader, {
        variant: "shine",
        size: 150,
        darkMode: useThemeStore.getState().isDark,
      }),
    );

    expect(html).toContain(`src="${BRAND_LOGO_DARK_BG}"`);
    expect(html).not.toContain("bg-white");
  });

  it("falls back to a white rounded tile in dark mode when lightLogoSrc is null", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().isDark).toBe(true);

    const html = renderToStaticMarkup(
      React.createElement(BrandLoader, {
        variant: "ring",
        darkMode: useThemeStore.getState().isDark,
        lightLogoSrc: null,
      }),
    );

    expect(html).toContain(`src="${BRAND_LOGO_LIGHT_BG}"`);
    expect(html).toContain("bg-white");
    expect(html).toContain("rounded-[12px]");
    expect(html).toContain("p-2");
  });

  it("RouteLoader renders the ring variant with label when delayMs is 0", () => {
    const html = renderToStaticMarkup(
      React.createElement(RouteLoader, {
        label: "Loading Pipeline Monitor",
        delayMs: 0,
      }),
    );

    expect(html).toContain("Loading Pipeline Monitor");
    expect(html).toContain("brand-loader-arc-1");
  });

  it("RouteLoader delays rendering when delayMs > 0 (initial SSR/mount frame)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RouteLoader, {
        label: "Loading Pipeline Monitor",
        delayMs: 300,
      }),
    );

    expect(html).not.toContain("Loading Pipeline Monitor");
  });

  it("index.html preloads both brand logos, sets favicon, and includes pre-JS splash", () => {
    expect(indexHtml).toContain(
      'rel="icon" type="image/svg+xml" href="/brand/logo-mark.svg"',
    );
    expect(indexHtml).toContain('rel="preload"');
    expect(indexHtml).toContain('href="/brand/logo-mark.svg"');
    expect(indexHtml).toContain('href="/brand/logo-mark-light.svg"');
    expect(indexHtml).toContain("app-boot-splash");
    expect(indexHtml).toContain("prefers-reduced-motion: reduce");
  });
});
