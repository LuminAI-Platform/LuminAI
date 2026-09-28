import React, { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
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
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-zinc-300 select-none flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 text-zinc-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full bg-zinc-950 text-zinc-100 text-xs rounded-lg border transition-all duration-150 outline-none placeholder:text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? "pl-9" : "pl-3"}
              ${rightIcon ? "pr-9" : "pr-3"}
              py-2
              ${
                error
                  ? "border-red-500/80 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
                  : "border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 hover:border-zinc-700"
              }
              ${className}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 text-zinc-400 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-[11px] text-red-400 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-zinc-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
