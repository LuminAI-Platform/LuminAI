import React, { useState } from "react";
import type { DBType } from "./dbConnectorTypes";
import { Select } from "../../../../components/ui/dropdown";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "../../../../lib/icons";
import {
  type DbFormErrors,
  type DbFormField,
  type ClassifiedConnectionError,
  parseConnectionString,
} from "./dbConnectorUtils";

const DB_TYPE_OPTIONS = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "snowflake", label: "Snowflake" },
  { value: "sqlserver", label: "SQL Server" },
];

export interface TestConnectionResult {
  latencyMs: number;
  schemaCount: number;
  tableCount: number;
}

interface ConnectorCredentialsProps {
  name: string;
  setName: (v: string) => void;
  dbType: DBType;
  host: string;
  setHost: (v: string) => void;
  port: string;
  onPortChange: (v: string) => void;
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
  connectionError: ClassifiedConnectionError | null;
  testResult: TestConnectionResult | null;
  onSubmitForm: (e: React.FormEvent) => void;
  handleDbTypeChange: (t: DBType) => void;
  onApplyConnectionString: (parsed: {
    dbType?: DBType;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
  }) => void;
}

export const ConnectorCredentials: React.FC<ConnectorCredentialsProps> = ({
  name,
  setName,
  dbType,
  host,
  setHost,
  port,
  onPortChange,
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
  connectionError,
  testResult,
  onSubmitForm,
  handleDbTypeChange,
  onApplyConnectionString,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConnString, setShowConnString] = useState(false);
  const [connStringInput, setConnStringInput] = useState("");
  const [connStringError, setConnStringError] = useState<string | null>(null);
  const [copiedDetails, setCopiedDetails] = useState(false);

  const handleParseConnString = () => {
    const parsed = parseConnectionString(connStringInput);
    if (!parsed) {
      setConnStringError(
        "Could not parse connection string. Use format like postgresql://user:pass@host:5432/db.",
      );
      return;
    }
    setConnStringError(null);
    onApplyConnectionString(parsed);
    // Clear immediately so sensitive credentials are not retained in an extra input
    setConnStringInput("");
    setShowConnString(false);
  };

  const handleCopyError = async () => {
    if (!connectionError?.technicalDetails) return;
    try {
      await navigator.clipboard.writeText(connectionError.technicalDetails);
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const fieldError = (field: DbFormField) =>
    touched[field] ? errors[field] : undefined;

  const inputClass = (field: DbFormField) =>
    `w-full bg-surface border rounded-lg py-2 px-3 text-xs text-text focus:outline-none placeholder:text-text-muted disabled:opacity-50 transition-colors ${
      fieldError(field)
        ? "border-error focus:border-error"
        : "border-border focus:border-border-focus"
    }`;

  return (
    <form
      id="db-connector-credentials-form"
      onSubmit={onSubmitForm}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Client-side connection string paste helper */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">
          Connection details
        </span>
        <button
          type="button"
          disabled={isVerifying}
          onClick={() => {
            setShowConnString((prev) => !prev);
            setConnStringError(null);
          }}
          className="text-xs font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer disabled:opacity-50"
        >
          {showConnString
            ? "Hide connection string"
            : "Paste connection string"}
        </button>
      </div>

      {showConnString && (
        <div className="p-3 rounded-lg bg-surface-subtle border border-border space-y-2">
          <label
            htmlFor="db-conn-string"
            className="block text-xs font-medium text-text"
          >
            Connection URI (parsed locally in your browser)
          </label>
          <div className="flex gap-2">
            <input
              id="db-conn-string"
              type="text"
              autoComplete="off"
              disabled={isVerifying}
              placeholder="postgresql://readonly_user:password@db.example.internal:5432/analytics"
              value={connStringInput}
              onChange={(e) => {
                setConnStringInput(e.target.value);
                if (connStringError) setConnStringError(null);
              }}
              className="flex-1 bg-surface border border-border rounded-lg py-1.5 px-2.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-focus"
            />
            <button
              type="button"
              onClick={handleParseConnString}
              disabled={!connStringInput.trim() || isVerifying}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs font-medium text-text transition-colors cursor-pointer disabled:opacity-50"
            >
              Fill fields
            </button>
          </div>
          {connStringError && (
            <p role="alert" className="text-xs text-error">
              {connStringError}
            </p>
          )}
        </div>
      )}

      {/* Connector name */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="db-connector-name"
          className="text-xs font-medium text-text"
        >
          Connector name
        </label>
        <input
          id="db-connector-name"
          type="text"
          required
          disabled={isVerifying}
          placeholder="Production PostgreSQL"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onBlurField("name")}
          aria-invalid={!!fieldError("name")}
          aria-describedby={fieldError("name") ? "db-name-error" : undefined}
          className={inputClass("name")}
        />
        {fieldError("name") && (
          <p id="db-name-error" role="alert" className="text-xs text-error">
            {fieldError("name")}
          </p>
        )}
      </div>

      {/* Database type + Port */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label
            htmlFor="db-connector-type"
            className="text-xs font-medium text-text"
          >
            Database type
          </label>
          <Select
            id="db-connector-type"
            value={dbType}
            disabled={isVerifying}
            onChange={(val) => handleDbTypeChange(val as DBType)}
            options={DB_TYPE_OPTIONS}
            ariaLabel="Database type"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="db-connector-port"
            className="text-xs font-medium text-text"
          >
            Port
          </label>
          <input
            id="db-connector-port"
            type="number"
            min={1}
            max={65535}
            required
            disabled={isVerifying}
            placeholder="5432"
            value={port}
            onChange={(e) => onPortChange(e.target.value)}
            onBlur={() => onBlurField("port")}
            aria-invalid={!!fieldError("port")}
            aria-describedby={fieldError("port") ? "db-port-error" : undefined}
            className={inputClass("port")}
          />
          {fieldError("port") && (
            <p id="db-port-error" role="alert" className="text-xs text-error">
              {fieldError("port")}
            </p>
          )}
        </div>
      </div>

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

      {/* Test success feedback */}
      {testResult && !connectionError && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-lg bg-success-bg border border-success-border text-success text-xs flex items-start gap-2.5"
        >
          <CheckCircle2
            className="w-4 h-4 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">
              Connection verified ({testResult.latencyMs} ms)
            </p>
            <p className="text-text-secondary mt-0.5">
              Found {testResult.schemaCount} schema
              {testResult.schemaCount === 1 ? "" : "s"} and{" "}
              {testResult.tableCount} table
              {testResult.tableCount === 1 ? "" : "s"}. Continue to choose
              tables.
            </p>
          </div>
        </div>
      )}

      {/* Specific classified error with collapsed technical details + Copy */}
      {connectionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 bg-error-bg border border-error-border rounded-lg text-xs space-y-2"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="w-4 h-4 text-error shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-error">
                {connectionError.title}
              </p>
              <p className="text-text-secondary leading-relaxed">
                {connectionError.suggestion}
              </p>
            </div>
          </div>

          <details className="text-[11px] text-text-secondary pl-6">
            <summary className="cursor-pointer select-none hover:text-text transition-colors">
              Technical details
            </summary>
            <div className="mt-2 p-2.5 rounded bg-surface border border-border flex items-start justify-between gap-2">
              <code className="font-mono text-[11px] text-error break-all flex-1">
                {connectionError.technicalDetails}
              </code>
              <button
                type="button"
                onClick={handleCopyError}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-surface-subtle hover:bg-surface-hover text-text text-[11px] font-medium shrink-0 cursor-pointer"
              >
                {copiedDetails ? (
                  <>
                    <Check
                      className="w-3 h-3 text-success"
                      aria-hidden="true"
                    />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </details>
        </div>
      )}
    </form>
  );
};
