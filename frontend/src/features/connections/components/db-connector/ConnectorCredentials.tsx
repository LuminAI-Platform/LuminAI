import React from "react";
import type { DBType } from "./dbConnectorTypes";

interface ConnectorCredentialsProps {
  name: string;
  setName: (v: string) => void;
  dbType: DBType;
  setDbType: (v: DBType) => void;
  host: string;
  setHost: (v: string) => void;
  port: number;
  setPort: (v: number) => void;
  databaseName: string;
  setDatabaseName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  isVerifying: boolean;
  validationError: string | null;
  onVerify: (e: React.FormEvent) => void;
  handleDbTypeChange: (t: DBType) => void;
}

export const ConnectorCredentials: React.FC<ConnectorCredentialsProps> = ({
  name,
  setName,
  dbType,
  host,
  setHost,
  port,
  setPort,
  databaseName,
  setDatabaseName,
  username,
  setUsername,
  password,
  setPassword,
  isVerifying,
  validationError,
  onVerify,
  handleDbTypeChange,
}) => {
  return (
    <form onSubmit={onVerify} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
          Connector Display Name
        </label>
        <input
          type="text"
          required
          disabled={isVerifying}
          placeholder="Production Postgres Master"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus placeholder:text-text-secondary disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Database Type
          </label>
          <select
            value={dbType}
            disabled={isVerifying}
            onChange={(e) => handleDbTypeChange(e.target.value as DBType)}
            className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus disabled:opacity-50 cursor-pointer"
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="snowflake">Snowflake</option>
            <option value="sqlserver">SQL Server</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Port
          </label>
          <input
            type="number"
            required
            disabled={isVerifying}
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus disabled:opacity-50 font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Database Host
          </label>
          <input
            type="text"
            required
            disabled={isVerifying}
            placeholder="db.replica.internal"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus placeholder:text-text-secondary disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Database Name
          </label>
          <input
            type="text"
            required
            disabled={isVerifying}
            placeholder="sales_db"
            value={databaseName}
            onChange={(e) => setDatabaseName(e.target.value)}
            className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus placeholder:text-text-secondary disabled:opacity-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Username
          </label>
          <input
            type="text"
            required
            disabled={isVerifying}
            placeholder="lumin_sync"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus placeholder:text-text-secondary disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            required
            disabled={isVerifying}
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface border border-border rounded-lg py-2 px-3 text-xs text-text focus:outline-none focus:border-border-focus placeholder:text-text-secondary disabled:opacity-50"
          />
        </div>
      </div>

      {validationError && (
        <div className="p-3 bg-error-bg border border-error-border text-error rounded-lg text-xs flex gap-2 font-medium">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{validationError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isVerifying}
        className="w-full bg-primary hover:bg-primary-hover text-primary-text font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-2"
      >
        {isVerifying ? (
          <>
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4"
                className="opacity-75"
              />
            </svg>
            Establishing Pipeline Connection...
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Connect & Discover Schemas
          </>
        )}
      </button>
    </form>
  );
};
