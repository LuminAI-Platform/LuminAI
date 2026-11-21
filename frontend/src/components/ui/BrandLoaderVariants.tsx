import React from "react";

interface VariantBaseProps {
  resolvedSize: number;
  activeLogoSrc: string;
  label?: string;
  statusText: string;
  className: string;
}

interface ThemedVariantProps extends VariantBaseProps {
  useWhiteTileFallback: boolean;
}

export const InlineBrandLoader: React.FC<VariantBaseProps> = ({
  resolvedSize,
  activeLogoSrc,
  label,
  statusText,
  className,
}) => {
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
};

export const ShineBrandLoader: React.FC<ThemedVariantProps> = ({
  resolvedSize,
  activeLogoSrc,
  useWhiteTileFallback,
  label,
  statusText,
  className,
}) => {
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
};
