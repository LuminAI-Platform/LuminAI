import { create } from "zustand";

export type AppEnvironment = "development" | "staging" | "production";

export interface EnvironmentConfig {
  id: AppEnvironment;
  label: string;
  shortLabel: string;
  description: string;
  isProduction: boolean;
  badgeClass: string;
  dotClass: string;
  footerTextClass: string;
}

export const ENVIRONMENT_CONFIGS: Record<AppEnvironment, EnvironmentConfig> = {
  production: {
    id: "production",
    label: "Production",
    shortLabel: "Prod",
    description: "Live customer data & active sync pipelines",
    isProduction: true,
    badgeClass: "bg-error-bg text-error border-error-border",
    dotClass: "bg-error animate-pulse",
    footerTextClass: "text-error",
  },
  staging: {
    id: "staging",
    label: "Staging",
    shortLabel: "Stage",
    description: "Pre-production test sandbox & mock pipelines",
    isProduction: false,
    badgeClass:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    dotClass: "bg-purple-500",
    footerTextClass: "text-purple-600 dark:text-purple-400",
  },
  development: {
    id: "development",
    label: "Development",
    shortLabel: "Dev",
    description: "Local development & sandbox tests",
    isProduction: false,
    badgeClass: "bg-surface-subtle text-text-secondary border-border",
    dotClass: "bg-text-secondary",
    footerTextClass: "text-text-secondary",
  },
};

export const STORAGE_KEY = "luminai_environment";

export function getInitialEnvironment(): AppEnvironment {
  if (typeof window === "undefined") return "production";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (
      stored === "production" ||
      stored === "staging" ||
      stored === "development"
    ) {
      return stored;
    }
  } catch {
    // LocalStorage might be restricted
  }
  return "production";
}

export interface EnvironmentState {
  environment: AppEnvironment;
  setEnvironment: (env: AppEnvironment) => void;
  config: EnvironmentConfig;
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  environment: getInitialEnvironment(),
  config: ENVIRONMENT_CONFIGS[getInitialEnvironment()],
  setEnvironment: (env: AppEnvironment) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, env);
      }
    } catch {
      // LocalStorage access may fail in private mode
    }
    set({
      environment: env,
      config: ENVIRONMENT_CONFIGS[env],
    });
  },
}));
