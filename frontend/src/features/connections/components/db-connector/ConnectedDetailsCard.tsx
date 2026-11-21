import React from "react";
import { CheckCircle2 } from "../../../../lib/icons";
import type { DBType } from "./dbConnectorTypes";
import type { ClassifiedConnectionError } from "./dbConnectorUtils";
import type { TestConnectionResult } from "./ConnectorCredentials";

interface ConnectedDetailsCardProps {
  name: string;
  dbType: DBType;
  host: string;
  port: string;
  databaseName: string;
  testResult: TestConnectionResult | null;
  connectionError: ClassifiedConnectionError | null;
}

export const ConnectedDetailsCard: React.FC<ConnectedDetailsCardProps> = ({
  name,
  dbType,
  host,
  port,
  databaseName,
  testResult,
  connectionError,
}) => {
  return (
    <div className="bg-surface-subtle/50 border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-success-bg border border-success-border flex items-center justify-center text-success shrink-0">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold text-success">
            Database connected
            {testResult ? ` (${testResult.latencyMs} ms)` : ""}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Select the tables to import from the right panel.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs bg-surface p-3.5 rounded-lg border border-border">
        <div>
          <dt className="text-text-secondary text-[11px]">Connector name</dt>
          <dd className="text-text font-medium truncate mt-0.5">{name}</dd>
        </div>
        <div>
          <dt className="text-text-secondary text-[11px]">Database type</dt>
          <dd className="text-text font-medium uppercase mt-0.5">{dbType}</dd>
        </div>
        <div>
          <dt className="text-text-secondary text-[11px]">Host</dt>
          <dd className="text-text font-mono text-[11px] truncate mt-0.5">
            {host}:{port}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary text-[11px]">Database</dt>
          <dd className="text-text font-mono text-[11px] truncate mt-0.5">
            {databaseName}
          </dd>
        </div>
      </dl>

      {connectionError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-error-bg border border-error-border text-xs text-error"
        >
          <p className="font-semibold">{connectionError.title}</p>
          <p className="text-text-secondary mt-0.5">
            {connectionError.suggestion}
          </p>
        </div>
      )}
    </div>
  );
};
