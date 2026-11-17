import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const STORAGE_KEY = "luminai_theme";

/**
 * Reads OS/browser color scheme preference.
 */
export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Resolves effective theme ("light" | "dark") from user preference ("light" | "dark" | "system").
 */
export function resolveTheme(theme: Theme | ResolvedTheme): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
}

/**
 * Retrieves the stored theme preference, defaulting to "system" for system-aware theming.
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    // LocalStorage access may be restricted
  }
  return "system";
}

/**
 * Applies the resolved theme classes and data attributes to the document root element.
 */
export function applyTheme(themeOrResolved: Theme | ResolvedTheme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(themeOrResolved);
  const root = document.documentElement;

  if (resolved === "dark") {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  }
}

const NEXT_THEME: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getInitialTheme();
  const initialResolved = resolveTheme(initialTheme);
  applyTheme(initialResolved);

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    isDark: initialResolved === "dark",

    setTheme: (theme: Theme) => {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // LocalStorage access may be restricted
      }
      const resolved = resolveTheme(theme);
      applyTheme(resolved);
      set({
        theme,
        resolvedTheme: resolved,
        isDark: resolved === "dark",
      });
    },

    toggleTheme: () => {
      const current = get().theme;
      const next = NEXT_THEME[current] ?? "light";
      get().setTheme(next);
    },
  };
});

// Setup system preference change listener and cross-tab storage sync
if (typeof window !== "undefined") {
  if (typeof window.matchMedia === "function") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const { theme } = useThemeStore.getState();
      if (theme === "system") {
        const resolved = getSystemTheme();
        applyTheme(resolved);
        useThemeStore.setState({
          resolvedTheme: resolved,
          isDark: resolved === "dark",
        });
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else if (
      typeof (mediaQuery as { addListener?: (cb: () => void) => void })
        .addListener === "function"
    ) {
      (mediaQuery as { addListener: (cb: () => void) => void }).addListener(
        handleMediaChange,
      );
    }
  }

  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      const newStored = event.newValue;
      if (
        newStored === "light" ||
        newStored === "dark" ||
        newStored === "system"
      ) {
        const resolved = resolveTheme(newStored);
        applyTheme(resolved);
        useThemeStore.setState({
          theme: newStored,
          resolvedTheme: resolved,
          isDark: resolved === "dark",
        });
      }
    }
  });
}
