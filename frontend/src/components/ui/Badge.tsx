import React from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  withDot?: boolean;
}

const BADGE_STYLES: Record<
  BadgeVariant,
  { bg: string; text: string; border: string; dot: string }
> = {
  default: {
    bg: "bg-transparent",
    text: "text-blue-400",
    border: "border-transparent",
    dot: "bg-blue-400",
  },
  success: {
    bg: "bg-transparent",
    text: "text-emerald-400",
    border: "border-transparent",
    dot: "bg-emerald-400",
  },
  warning: {
    bg: "bg-transparent",
    text: "text-amber-400",
    border: "border-transparent",
    dot: "bg-amber-400",
  },
  danger: {
    bg: "bg-transparent",
    text: "text-red-400",
    border: "border-transparent",
    dot: "bg-red-400",
  },
  info: {
    bg: "bg-transparent",
    text: "text-cyan-400",
    border: "border-transparent",
    dot: "bg-cyan-400",
  },
  purple: {
    bg: "bg-transparent",
    text: "text-purple-400",
    border: "border-transparent",
    dot: "bg-purple-400",
  },
  neutral: {
    bg: "bg-transparent",
    text: "text-zinc-400",
    border: "border-transparent",
    dot: "bg-zinc-400",
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
  const style = BADGE_STYLES[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.text} ${style.border} select-none ${className}`}
      {...props}
    >
      {withDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />}
      {children}
    </span>
  );
};
