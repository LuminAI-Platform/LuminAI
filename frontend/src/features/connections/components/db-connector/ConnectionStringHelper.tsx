import React, { useState } from "react";
import type { DBType } from "./dbConnectorTypes";
import { parseConnectionString } from "./dbConnectorUtils";

interface ConnectionStringHelperProps {
  isVerifying: boolean;
  onApplyConnectionString: (parsed: {
    dbType?: DBType;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
  }) => void;
}

export const ConnectionStringHelper: React.FC<ConnectionStringHelperProps> = ({
  isVerifying,
  onApplyConnectionString,
}) => {
  const [showConnString, setShowConnString] = useState(false);
  const [connStringInput, setConnStringInput] = useState("");
  const [connStringError, setConnStringError] = useState<string | null>(null);

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
    setConnStringInput("");
    setShowConnString(false);
  };

  return (
    <>
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
          {showConnString ? "Hide connection string" : "Paste connection string"}
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
    </>
  );
};
