import React from "react";

interface BrandLoaderRingProps {
  resolvedSize: number;
  activeLogoSrc: string;
  isDark: boolean;
  useWhiteTileFallback: boolean;
  label?: string;
  statusText?: string;
  className?: string;
}

export const BrandLoaderRing: React.FC<BrandLoaderRingProps> = ({
  resolvedSize,
  activeLogoSrc,
  isDark,
  useWhiteTileFallback,
  label,
  statusText = "Loading",
  className = "",
}) => {
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
          <circle
            cx={center}
            cy={center}
            r={rOuter}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="2.2"
          />
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
