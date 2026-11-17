import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useThemeStore,
  resolveTheme,
  applyTheme,
  getSystemTheme,
  STORAGE_KEY,
} from "../stores/themeStore";

describe("System-Aware Theming Store", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("resolves explicit light and dark themes correctly", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolves system theme based on matchMedia prefers-color-scheme", () => {
    // Mock system preference: dark
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    expect(getSystemTheme()).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");

    // Mock system preference: light
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    expect(getSystemTheme()).toBe("light");
    expect(resolveTheme("system")).toBe("light");

    vi.unstubAllGlobals();
  });

  it("applies theme classes, attributes, and colorScheme to document root", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("updates store state and persists to localStorage on setTheme", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(useThemeStore.getState().resolvedTheme).toBe("dark");
    expect(useThemeStore.getState().isDark).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");
    expect(useThemeStore.getState().resolvedTheme).toBe("light");
    expect(useThemeStore.getState().isDark).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    useThemeStore.getState().setTheme("system");
    expect(useThemeStore.getState().theme).toBe("system");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
  });

  it("cycles through system -> light -> dark -> system via toggleTheme", () => {
    useThemeStore.getState().setTheme("system");
    expect(useThemeStore.getState().theme).toBe("system");

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("system");
  });
});
