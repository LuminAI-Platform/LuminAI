import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 active:scale-[0.98] border border-blue-500/40",
  secondary:
    "bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 active:scale-[0.98]",
  danger:
    "bg-red-600/90 hover:bg-red-500 text-white shadow-sm shadow-red-500/20 active:scale-[0.98] border border-red-500/40",
  ghost:
    "bg-transparent hover:bg-zinc-800/60 text-zinc-300 hover:text-zinc-100",
  outline:
    "bg-transparent hover:bg-zinc-800/40 text-zinc-300 border border-zinc-700 hover:border-zinc-600",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-[11px] gap-1 rounded-md",
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-5 py-2.5 text-base gap-2.5 rounded-xl",
};

/**
 * Reusable Production Button Component
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
