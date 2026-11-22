import React from "react";

interface BrandLoaderInlineProps {
  resolvedSize: number;
  activeLogoSrc: string;
  label?: string;
  statusText?: string;
  className?: string;
}

export const BrandLoaderInline: React.FC<BrandLoaderInlineProps> = ({
  resolvedSize,
  activeLogoSrc,
  label,
  statusText = "Loading",
  className = "",
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
