import React from "react";
import type { DBType } from "./dbConnectorTypes";
import { Select } from "../../../../components/ui/dropdown";
import { CheckCircle2 } from "../../../../lib/icons";
import {
  type DbFormErrors,
  type DbFormField,
  type ClassifiedConnectionError,
} from "./dbConnectorUtils";
import { ConnectionStringHelper } from "./ConnectionStringHelper";
import { ConnectionErrorAlert } from "./ConnectionErrorAlert";
import { ConnectorAuthInputs } from "./ConnectorAuthInputs";

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
      <ConnectionStringHelper
        isVerifying={isVerifying}
        onApplyConnectionString={onApplyConnectionString}
      />

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

      <ConnectorAuthInputs
        host={host}
        setHost={setHost}
        databaseName={databaseName}
        setDatabaseName={setDatabaseName}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        errors={errors}
        touched={touched}
        onBlurField={onBlurField}
        isVerifying={isVerifying}
        inputClass={inputClass}
      />

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

      {connectionError && (
        <ConnectionErrorAlert connectionError={connectionError} />
      )}
    </form>
  );
};
