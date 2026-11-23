import React, { useEffect, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { BRAND_LOGO_LIGHT_BG, BRAND_LOGO_DARK_BG } from "./brandLoaderUtils";
import { BrandLoaderInline } from "./brand-loader/BrandLoaderInline";
import { BrandLoaderRing } from "./brand-loader/BrandLoaderRing";

export type BrandLoaderVariant = "ring" | "shine" | "inline";

export interface BrandLoaderProps {
  variant?: BrandLoaderVariant;
  size?: number;
  label?: string;
  statusText?: string;
  darkMode?: boolean;
  logoSrc?: string;
  lightLogoSrc?: string | null;
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
      <BrandLoaderInline
        resolvedSize={resolvedSize}
        activeLogoSrc={activeLogoSrc}
        label={label}
        statusText={statusText}
        className={className}
      />
    );
  }

  if (variant === "shine") {
    const imgSize = useWhiteTileFallback
      ? Math.max(24, resolvedSize - 16)
      : resolvedSize;

    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex flex-col items-center justify-center gap-4 select-none ${className}`}
      >
        <div
          className={`relative inline-flex items-center justify-center shrink-0 ${
            useWhiteTileFallback ? "bg-white rounded-[12px] p-2 shadow-sm" : ""
          }`}
          style={{ width: resolvedSize, height: resolvedSize }}
        >
          <img
            src={activeLogoSrc}
            alt=""
            aria-hidden="true"
            width={imgSize}
            height={imgSize}
            draggable={false}
            decoding="async"
            className="brand-loader-shine-base object-contain select-none"
            style={{ width: imgSize, height: imgSize }}
          />
          <img
            src={activeLogoSrc}
            alt=""
            aria-hidden="true"
            width={imgSize}
            height={imgSize}
            draggable={false}
            decoding="async"
            className="brand-loader-shine-overlay object-contain select-none absolute pointer-events-none"
            style={{ width: imgSize, height: imgSize }}
          />
        </div>
        {label ? (
          <span className="text-sm font-medium text-text-secondary tracking-tight">
            {label}
          </span>
        ) : (
          <span className="sr-only">{statusText}</span>
        )}
      </div>
    );
  }

  return (
    <BrandLoaderRing
      resolvedSize={resolvedSize}
      activeLogoSrc={activeLogoSrc}
      isDark={isDark}
      useWhiteTileFallback={useWhiteTileFallback}
      label={label}
      statusText={statusText}
      className={className}
    />
  );
};

export interface RouteLoaderProps {
  label: string;
  delayMs?: number;
  size?: number;
  className?: string;
}

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
