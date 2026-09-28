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
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/25",
    dot: "bg-blue-400",
  },
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400 animate-pulse",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/25",
    dot: "bg-amber-400",
  },
  danger: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/25",
    dot: "bg-red-400",
  },
  info: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/25",
    dot: "bg-cyan-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/25",
    dot: "bg-purple-400",
  },
  neutral: {
    bg: "bg-zinc-800/60",
    text: "text-zinc-300",
    border: "border-zinc-700/60",
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
