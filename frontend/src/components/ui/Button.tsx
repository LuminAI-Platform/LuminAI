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

/**
 * Button Design System Rules:
 * - Make navy the only filled button color.
 * - Keep one primary button per screen, and style the rest as outlined.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Navy is the ONLY filled button color
  primary:
    "bg-primary hover:bg-primary-hover text-primary-text border border-primary shadow-xs active:scale-[0.98]",
  // Secondary is styled as outlined
  secondary:
    "bg-transparent hover:bg-surface-subtle text-text border border-border hover:border-text-secondary/50 active:scale-[0.98]",
  // Danger is styled as outlined with red border/text
  danger:
    "bg-transparent hover:bg-error-bg text-error border border-error/40 hover:border-error active:scale-[0.98]",
  ghost:
    "bg-transparent hover:bg-surface-subtle text-text-secondary hover:text-text",
  outline:
    "bg-transparent hover:bg-surface-subtle text-text border border-border hover:border-text-secondary/50",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-[11px] gap-1 rounded-lg",
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-5 py-2.5 text-base gap-2.5 rounded-lg",
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
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
