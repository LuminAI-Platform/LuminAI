import React from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "nodata"
  | "suggested"
  | "purple"
  | "zinc";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  withDot?: boolean;
}

/**
 * Status and Tag Badge Design System Tokens
 *
 * Rules:
 * - Never use color alone for status: always paired with word or icon.
 * - One color per meaning: Active, Online, Healthy -> success token.
 * - Delete neon cyan/green dots and glows.
 * - AI suggested: calm neutral or navy-tint tag with no sparkles/glows.
 */
const BADGE_STYLES: Record<
  BadgeVariant,
  { bg: string; text: string; border: string; dot: string }
> = {
  // Primary / default
  default: {
    bg: "bg-surface-subtle",
    text: "text-primary",
    border: "border-border",
    dot: "bg-primary",
  },
  // Success (Active, Online, Healthy, Connected)
  success: {
    bg: "bg-success-bg",
    text: "text-success font-medium",
    border: "border-success-border",
    dot: "bg-success",
  },
  // Warning
  warning: {
    bg: "bg-warning-bg",
    text: "text-warning font-medium",
    border: "border-warning-border",
    dot: "bg-warning",
  },
  // Danger / Error
  danger: {
    bg: "bg-error-bg",
    text: "text-error font-medium",
    border: "border-error-border",
    dot: "bg-error",
  },
  // Info maps cleanly to calm neutral/primary tone, not neon cyan
  info: {
    bg: "bg-surface-subtle",
    text: "text-text-secondary font-medium",
    border: "border-border",
    dot: "bg-text-secondary",
  },
  // No data / unknown
  nodata: {
    bg: "bg-nodata-bg",
    text: "text-nodata font-medium",
    border: "border-nodata-border",
    dot: "bg-nodata",
  },
  // Calm neutral fallback for legacy variants
  purple: {
    bg: "bg-surface-subtle",
    text: "text-primary font-medium",
    border: "border-border",
    dot: "bg-primary",
  },
  zinc: {
    bg: "bg-surface-subtle",
    text: "text-text-secondary font-medium",
    border: "border-border",
    dot: "bg-text-secondary",
  },
  neutral: {
    bg: "bg-surface-subtle",
    text: "text-text-secondary",
    border: "border-border",
    dot: "bg-text-secondary",
  },
  // AI-suggested: calm neutral or navy-tint tag that says "Suggested", no sparkle or glow
  suggested: {
    bg: "bg-suggested-bg",
    text: "text-suggested font-medium",
    border: "border-suggested-border",
    dot: "bg-suggested",
  },
};

/**
 * Reusable Status & Tag Badge Component
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  withDot = false,
  className = "",
  ...props
}) => {
  const style = BADGE_STYLES[variant] || BADGE_STYLES.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border ${style.bg} ${style.text} ${style.border} select-none ${className}`}
      {...props}
    >
      {withDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      )}
      {children}
    </span>
  );
};

/**
 * Calm AI-Suggested Tag Component
 * Rule 5: Use AI-suggested indicators in a calm way: a small neutral or navy-tint tag
 * that says "Suggested", with no sparkle or special glow.
 */
export const SuggestedTag: React.FC<{ label?: string; className?: string }> = ({
  label = "Suggested",
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-suggested-bg text-suggested border border-suggested-border select-none ${className}`}
    >
      {label}
    </span>
  );
};
