import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Reusable Production Form Input Component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      className = "",
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId =
      id ||
      (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-text select-none flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 text-text-secondary pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full bg-surface text-text text-xs rounded-lg border transition-colors duration-150 outline-none placeholder:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? "pl-9" : "pl-3"}
              ${rightIcon ? "pr-9" : "pr-3"}
              py-2
              ${
                error
                  ? "border-error focus:border-error focus:ring-1 focus:ring-error/30"
                  : "border-border focus:border-border-focus focus:ring-1 focus:ring-border-focus/20 hover:border-text-secondary/50"
              }
              ${className}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 text-text-secondary flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-[11px] text-error font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
