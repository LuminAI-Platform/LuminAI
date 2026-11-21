import React, { useState } from "react";
import { Eye, EyeOff } from "../../../../lib/icons";

interface CredentialFieldProps {
  id: string;
  label: string;
  errorId: string;
  error?: string;
  hintId?: string;
  hint?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  autoComplete?: string;
  disabled: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export const CredentialField: React.FC<CredentialFieldProps> = ({
  id,
  label,
  errorId,
  error,
  hintId,
  hint,
  type = "text",
  min,
  max,
  autoComplete,
  disabled,
  placeholder,
  value,
  onChange,
  onBlur,
}) => {
  const describedBy =
    [error ? errorId : undefined, hintId].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        required
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`w-full bg-surface border rounded-lg py-2 px-3 text-xs text-text focus:outline-none placeholder:text-text-muted disabled:opacity-50 transition-colors ${
          error
            ? "border-error focus:border-error"
            : "border-border focus:border-border-focus"
        }`}
      />
      {hint && hintId && (
        <p id={hintId} className="text-[11px] text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
};

interface PasswordFieldProps {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  error,
  disabled,
  onChange,
  onBlur,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="db-connector-password"
        className="text-xs font-medium text-text"
      >
        Password
      </label>
      <div className="relative">
        <input
          id="db-connector-password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="new-password"
          disabled={disabled}
          placeholder="Enter password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? "db-password-error" : undefined}
          className={`w-full bg-surface border rounded-lg py-2 px-3 pr-9 text-xs text-text focus:outline-none placeholder:text-text-muted disabled:opacity-50 transition-colors ${
            error
              ? "border-error focus:border-error"
              : "border-border focus:border-border-focus"
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          {showPassword ? (
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id="db-password-error" role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
};
