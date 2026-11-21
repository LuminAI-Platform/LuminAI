import React from "react";

export const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
}> = ({ data, width = 56, height = 20 }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible shrink-0 text-primary"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface SyncJobKpiCardProps {
  label: string;
  trailing: React.ReactNode;
  value: string;
  valueClassName?: string;
  caption: string;
  captionTitle?: string;
}

export const SyncJobKpiCard: React.FC<SyncJobKpiCardProps> = ({
  label,
  trailing,
  value,
  valueClassName = "text-text",
  caption,
  captionTitle,
}) => {
  return (
    <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between gap-2 min-w-0 h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary truncate">
          {label}
        </span>
        {trailing}
      </div>
      <div className="min-w-0">
        <div
          className={`text-sm font-semibold leading-snug line-clamp-2 break-words ${valueClassName}`}
          title={value}
        >
          {value}
        </div>
        <div
          className="text-xs text-text-secondary leading-snug line-clamp-2 mt-0.5"
          title={captionTitle}
        >
          {caption}
        </div>
      </div>
    </div>
  );
};
