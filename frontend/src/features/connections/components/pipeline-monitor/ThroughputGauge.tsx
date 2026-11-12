import React from "react";

export const ThroughputGauge: React.FC<{ value: number; max?: number }> = ({
  value,
  max = 50_000,
}) => {
  const pct = Math.min(value / max, 1);
  const angle = -135 + pct * 270;
  const r = 36;
  const cx = 48;
  const cy = 52;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX = (deg: number) => cx + r * Math.cos(toRad(deg));
  const arcY = (deg: number) => cy + r * Math.sin(toRad(deg));

  const trackStart = -135;
  const trackEnd = 135;
  const fillEnd = trackStart + pct * 270;

  const largeArcTrack = 1;
  const trackD = `M ${arcX(trackStart)} ${arcY(trackStart)} A ${r} ${r} 0 ${largeArcTrack} 1 ${arcX(trackEnd)} ${arcY(trackEnd)}`;

  const largeArcFill = pct > 180 / 270 ? 1 : 0;
  const fillD =
    pct <= 0.005
      ? ""
      : `M ${arcX(trackStart)} ${arcY(trackStart)} A ${r} ${r} 0 ${largeArcFill} 1 ${arcX(fillEnd)} ${arcY(fillEnd)}`;

  return (
    <svg
      width="96"
      height="72"
      viewBox="0 0 96 72"
      className="overflow-visible select-none"
    >
      <path
        d={trackD}
        fill="none"
        stroke="#27272a"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {fillD && (
        <path
          d={fillD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="6"
          strokeLinecap="round"
        />
      )}
      <circle cx={cx} cy={cy} r="4" fill="#3b82f6" />
      <line
        x1={cx}
        y1={cy}
        x2={cx + 28 * Math.cos(toRad(angle))}
        y2={cy + 28 * Math.sin(toRad(angle))}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
