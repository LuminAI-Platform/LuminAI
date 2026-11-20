import React, { useEffect, useState } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { BRAND_LOGO_LIGHT_BG, BRAND_LOGO_DARK_BG } from "./brandLoaderUtils";

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

  // ── Inline Variant (buttons & refreshes) ───────────────────────────────────
  if (variant === "inline") {
    const logoSize = Math.max(8, Math.round(resolvedSize * 0.55));
    const viewBox = 24;
    const radius = 10;
    const circumference = 2 * Math.PI * radius;

    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center justify-center gap-1.5 shrink-0 ${className}`}
      >
        <span
          className="relative inline-flex items-center justify-center shrink-0"
          style={{ width: resolvedSize, height: resolvedSize }}
        >
          <svg
            width={resolvedSize}
            height={resolvedSize}
            viewBox={`0 0 ${viewBox} ${viewBox}`}
            fill="none"
            aria-hidden="true"
            className="absolute inset-0"
          >
            <circle
              cx={viewBox / 2}
              cy={viewBox / 2}
              r={radius}
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth="2.2"
            />
            <circle
              cx={viewBox / 2}
              cy={viewBox / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.34} ${circumference * 0.66}`}
              className="brand-loader-inline-ring"
            />
          </svg>
          <img
            src={activeLogoSrc}
            alt=""
            aria-hidden="true"
            width={logoSize}
            height={logoSize}
            draggable={false}
            decoding="async"
            className="object-contain select-none relative z-10"
            style={{ width: logoSize, height: logoSize }}
          />
        </span>
        {label ? (
          <span className="text-xs font-medium text-current">{label}</span>
        ) : (
          <span className="sr-only">{statusText}</span>
        )}
      </span>
    );
  }

  // ── Shine Variant (splash & first-load) ────────────────────────────────────
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
          {/* Base logo at 0.2 opacity (1.0 under prefers-reduced-motion) */}
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
          {/* Full-opacity overlay masked by sweeping linear-gradient band */}
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

  // ── Ring Variant (route loading) ───────────────────────────────────────────
  const logoSize = Math.round(resolvedSize * 0.6);
  const viewBox = 100;
  const center = 50;
  const rOuter = 45;
  const rMid = 40;
  const rInner = 35;
  const cOuter = 2 * Math.PI * rOuter;
  const cMid = 2 * Math.PI * rMid;
  const cInner = 2 * Math.PI * rInner;

  const arcPrimary = isDark ? "#6B97FF" : "#12297A";
  const arcAccent = isDark ? "#F87171" : "#D31A24";
  const arcMuted = isDark
    ? "rgba(163, 173, 191, 0.35)"
    : "rgba(18, 41, 122, 0.22)";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center justify-center gap-3.5 select-none ${className}`}
    >
      <div
        className="relative inline-flex items-center justify-center shrink-0"
        style={{ width: resolvedSize, height: resolvedSize }}
      >
        <svg
          width={resolvedSize}
          height={resolvedSize}
          viewBox={`0 0 ${viewBox} ${viewBox}`}
          fill="none"
          aria-hidden="true"
          className="absolute inset-0"
        >
          {/* Subtle static track */}
          <circle
            cx={center}
            cy={center}
            r={rOuter}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="2.2"
          />
          {/* Arc 1: Outer primary rotating arc */}
          <circle
            cx={center}
            cy={center}
            r={rOuter}
            stroke={arcPrimary}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray={`${cOuter * 0.28} ${cOuter * 0.72}`}
            className="brand-loader-arc-1"
          />
          {/* Arc 2: Middle accent counter-rotating arc */}
          <circle
            cx={center}
            cy={center}
            r={rMid}
            stroke={arcAccent}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeDasharray={`${cMid * 0.22} ${cMid * 0.78}`}
            strokeDashoffset={cMid * 0.35}
            className="brand-loader-arc-2"
          />
          {/* Arc 3: Inner subtle rotating arc */}
          <circle
            cx={center}
            cy={center}
            r={rInner}
            stroke={arcMuted}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={`${cInner * 0.32} ${cInner * 0.68}`}
            strokeDashoffset={cInner * 0.65}
            className="brand-loader-arc-3"
          />
        </svg>

        <div
          className={`relative z-10 inline-flex items-center justify-center ${
            useWhiteTileFallback ? "bg-white rounded-[12px] p-2 shadow-xs" : ""
          }`}
        >
          <img
            src={activeLogoSrc}
            alt=""
            aria-hidden="true"
            width={logoSize}
            height={logoSize}
            draggable={false}
            decoding="async"
            className="brand-loader-pulse object-contain select-none"
            style={{ width: logoSize, height: logoSize }}
          />
        </div>
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
