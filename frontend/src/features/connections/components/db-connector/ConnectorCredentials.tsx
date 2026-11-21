import React from "react";
import type { DBType } from "./dbConnectorTypes";
import { Select } from "../../../../components/ui/dropdown";
import type {
  DbFormErrors,
  DbFormField,
  ClassifiedConnectionError,
  ParsedConnectionString,
} from "./dbConnectorUtils";
import { ConnectionStringPaste } from "./ConnectionStringPaste";
import { ConnectionFeedbackBanner } from "./ConnectionFeedbackBanner";
import { CredentialField, PasswordField } from "./CredentialField";

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
  onApplyConnectionString: (parsed: ParsedConnectionString) => void;
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

  return (
    <form
      id="db-connector-credentials-form"
      onSubmit={onSubmitForm}
      noValidate
      className="flex flex-col gap-4"
    >
      <ConnectionStringPaste
        disabled={isVerifying}
        onApply={onApplyConnectionString}
      />

      <CredentialField
        id="db-connector-name"
        label="Connector name"
        errorId="db-name-error"
        error={fieldError("name")}
        disabled={isVerifying}
        placeholder="Production PostgreSQL"
        value={name}
        onChange={setName}
        onBlur={() => onBlurField("name")}
      />

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

        <CredentialField
          id="db-connector-port"
          label="Port"
          errorId="db-port-error"
          error={fieldError("port")}
          type="number"
          min={1}
          max={65535}
          disabled={isVerifying}
          placeholder="5432"
          value={port}
          onChange={onPortChange}
          onBlur={() => onBlurField("port")}
        />
      </div>

      {/* Host + Database */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CredentialField
          id="db-connector-host"
          label="Host"
          errorId="db-host-error"
          error={fieldError("host")}
          disabled={isVerifying}
          placeholder="db.replica.internal"
          value={host}
          onChange={setHost}
          onBlur={() => onBlurField("host")}
        />

        <CredentialField
          id="db-connector-database"
          label="Database"
          errorId="db-database-error"
          error={fieldError("databaseName")}
          disabled={isVerifying}
          placeholder="sales_db"
          value={databaseName}
          onChange={setDatabaseName}
          onBlur={() => onBlurField("databaseName")}
        />
      </div>

      {/* Username + Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CredentialField
          id="db-connector-username"
          label="Username"
          errorId="db-username-error"
          error={fieldError("username")}
          hintId="db-username-hint"
          hint="Use a read-only database user."
          autoComplete="off"
          disabled={isVerifying}
          placeholder="lumin_readonly"
          value={username}
          onChange={setUsername}
          onBlur={() => onBlurField("username")}
        />

        <PasswordField
          value={password}
          error={fieldError("password")}
          disabled={isVerifying}
          onChange={setPassword}
          onBlur={() => onBlurField("password")}
        />
      </div>

      <ConnectionFeedbackBanner
        testResult={testResult}
        connectionError={connectionError}
      />
    </form>
  );
};
