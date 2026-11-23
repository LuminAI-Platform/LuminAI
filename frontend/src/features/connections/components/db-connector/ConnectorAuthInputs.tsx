import React, { useState } from "react";
import { Eye, EyeOff } from "../../../../lib/icons";
import type { DbFormErrors, DbFormField } from "./dbConnectorUtils";

interface ConnectorAuthInputsProps {
  host: string;
  setHost: (v: string) => void;
  databaseName: string;
  setDatabaseName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  errors: DbFormErrors;
  touched: Partial<Record<DbFormField, boolean>>;
  onBlurField: (field: DbFormField) => void;
  isVerifying: boolean;
  inputClass: (field: DbFormField) => string;
}

export const ConnectorAuthInputs: React.FC<ConnectorAuthInputsProps> = ({
  host,
  setHost,
  databaseName,
  setDatabaseName,
  username,
  setUsername,
  password,
  setPassword,
  errors,
  touched,
  onBlurField,
  isVerifying,
  inputClass,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const fieldError = (field: DbFormField) =>
    touched[field] ? errors[field] : undefined;

  return (
    <>
      {/* Host + Database */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="db-connector-host"
            className="text-xs font-medium text-text"
          >
            Host
          </label>
          <input
            id="db-connector-host"
            type="text"
            required
            disabled={isVerifying}
            placeholder="db.replica.internal"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onBlur={() => onBlurField("host")}
            aria-invalid={!!fieldError("host")}
            aria-describedby={fieldError("host") ? "db-host-error" : undefined}
            className={inputClass("host")}
          />
          {fieldError("host") && (
            <p id="db-host-error" role="alert" className="text-xs text-error">
              {fieldError("host")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="db-connector-database"
            className="text-xs font-medium text-text"
          >
            Database
          </label>
          <input
            id="db-connector-database"
            type="text"
            required
            disabled={isVerifying}
            placeholder="sales_db"
            value={databaseName}
            onChange={(e) => setDatabaseName(e.target.value)}
            onBlur={() => onBlurField("databaseName")}
            aria-invalid={!!fieldError("databaseName")}
            aria-describedby={
              fieldError("databaseName") ? "db-database-error" : undefined
            }
            className={inputClass("databaseName")}
          />
          {fieldError("databaseName") && (
            <p
              id="db-database-error"
              role="alert"
              className="text-xs text-error"
            >
              {fieldError("databaseName")}
            </p>
          )}
        </div>
      </div>

      {/* Username + Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="db-connector-username"
            className="text-xs font-medium text-text"
          >
            Username
          </label>
          <input
            id="db-connector-username"
            type="text"
            required
            autoComplete="off"
            disabled={isVerifying}
            placeholder="lumin_readonly"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => onBlurField("username")}
            aria-invalid={!!fieldError("username")}
            aria-describedby={
              fieldError("username")
                ? "db-username-error db-username-hint"
                : "db-username-hint"
            }
            className={inputClass("username")}
          />
          <p id="db-username-hint" className="text-[11px] text-text-secondary">
            Use a read-only database user.
          </p>
          {fieldError("username") && (
            <p
              id="db-username-error"
              role="alert"
              className="text-xs text-error"
            >
              {fieldError("username")}
            </p>
          )}
        </div>

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
              disabled={isVerifying}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => onBlurField("password")}
              aria-invalid={!!fieldError("password")}
              aria-describedby={
                fieldError("password") ? "db-password-error" : undefined
              }
              className={`${inputClass("password")} pr-9`}
            />
            <button
              type="button"
              disabled={isVerifying}
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
          {fieldError("password") && (
            <p
              id="db-password-error"
              role="alert"
              className="text-xs text-error"
            >
              {fieldError("password")}
            </p>
          )}
        </div>
      </div>
    </>
  );
};
