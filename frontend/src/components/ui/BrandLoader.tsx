import React, { useEffect, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { BRAND_LOGO_LIGHT_BG, BRAND_LOGO_DARK_BG } from "./brandLoaderUtils";
import { InlineBrandLoader, ShineBrandLoader } from "./BrandLoaderVariants";
import { RingBrandLoader } from "./BrandLoaderRing";

export type BrandLoaderVariant = "ring" | "shine" | "inline";

export interface BrandLoaderProps {
  /** Visual variant: "ring" (route/page), "shine" (splash/first-load), or "inline" (buttons/refreshes) */
  variant?: BrandLoaderVariant;
  /** Overall diameter in pixels (defaults: ring=88, shine=150, inline=18) */
  size?: number;
  /** Optional visible label shown below/beside the loader (e.g. "Loading Pipeline Monitor") */
  label?: string;
  /** Accessible status text announced when no visible label is provided */
  statusText?: string;
  /** Optional dark mode override; defaults to the active theme store (including System setting) */
  darkMode?: boolean;
  /** Optional custom logo source for light theme */
  logoSrc?: string;
  /** Optional custom logo source for dark theme (pass null to use the white rounded tile fallback) */
  lightLogoSrc?: string | null;
  /** Additional CSS classes for the root status container */
  className?: string;
}

const DEFAULT_SIZES: Record<BrandLoaderVariant, number> = {
  ring: 88,
  shine: 150,
  inline: 18,
};

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  variant = "ring",
  size,
  label,
  statusText = "Loading",
  darkMode,
  logoSrc = BRAND_LOGO_LIGHT_BG,
  lightLogoSrc = BRAND_LOGO_DARK_BG,
  className = "",
}) => {
  const storeIsDark = useThemeStore((state) => state.isDark);
  const isDark = darkMode ?? storeIsDark;

  const resolvedSize = size ?? DEFAULT_SIZES[variant];
  const useWhiteTileFallback = isDark && !lightLogoSrc;
  const activeLogoSrc = isDark && lightLogoSrc ? lightLogoSrc : logoSrc;

  if (variant === "inline") {
    return (
      <InlineBrandLoader
        resolvedSize={resolvedSize}
        activeLogoSrc={activeLogoSrc}
        label={label}
        statusText={statusText}
        className={className}
      />
    );
  }

  if (variant === "shine") {
    return (
      <ShineBrandLoader
        resolvedSize={resolvedSize}
        activeLogoSrc={activeLogoSrc}
        useWhiteTileFallback={useWhiteTileFallback}
        label={label}
        statusText={statusText}
        className={className}
      />
    );
  }

  return (
    <RingBrandLoader
      resolvedSize={resolvedSize}
      activeLogoSrc={activeLogoSrc}
      useWhiteTileFallback={useWhiteTileFallback}
      isDark={isDark}
      label={label}
      statusText={statusText}
      className={className}
    />
  );
};

export interface RouteLoaderProps {
  /** Label describing the route being loaded, e.g. "Loading Pipeline Monitor" */
  label: string;
  /** Delay in ms before rendering the loader (default 300ms; pass 0 when TanStack Router already delays) */
  delayMs?: number;
  /** Ring diameter in pixels (default 88) */
  size?: number;
  className?: string;
}

/**
 * Centered route-level page loader using the `ring` BrandLoader variant.
 * Supports an optional delay (default 300ms) for React Suspense boundaries.
 */
export const RouteLoader: React.FC<RouteLoaderProps> = ({
  label,
  delayMs = 300,
  size = 88,
  className = "",
}) => {
  const [ready, setReady] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setReady(true);
      return;
    }
    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!ready) {
    return (
      <div
        className={`flex min-h-[60vh] w-full items-center justify-center ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`flex min-h-[60vh] w-full items-center justify-center ${className}`}
    >
      <BrandLoader variant="ring" size={size} label={label} />
    </div>
  );
};
