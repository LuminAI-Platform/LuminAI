import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  type DatabaseConnector,
  formatRelativeTime,
  getHealthStatusBadge,
} from "./connectionsTypes";
import { Database, Layers, ArrowRight, Trash2 } from "lucide-react";
import { ActionMenu } from "../../../components/ui/dropdown";

interface ConnectorsTableProps {
  customConnectors: DatabaseConnector[];
  onAddConnector: () => void;
  onDeleteConnector: (connector: DatabaseConnector) => void;
}

export const ConnectorsTable: React.FC<ConnectorsTableProps> = ({
  customConnectors,
  onAddConnector,
  onDeleteConnector,
}) => {
  const navigate = useNavigate();
  if (customConnectors.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
          <Database className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-text">
          No database connections
        </h4>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          Connect PostgreSQL, Snowflake, ClickHouse, or MySQL instances to
          schedule automated batch syncs.
        </p>
        <button
          onClick={onAddConnector}
          className="mt-4 px-3.5 py-1.5 bg-primary hover:bg-primary-hover border border-primary text-primary-text rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          Add Database Connection
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-subtle border-b border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              <th className="py-3 px-4">Connector</th>
              <th className="py-3 px-4">Database Type</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Synced Tables</th>
              <th className="py-3 px-4">Last Telemetry</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customConnectors.map((c) => {
              const statusCfg = getHealthStatusBadge(c.status);
              return (
                <tr
                  key={c.id ?? c.name}
                  className="hover:bg-surface-hover transition-colors group"
                >
                  <td className="py-3 px-4 font-semibold text-text flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary shrink-0">
                      <Database className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span
                        className="block truncate max-w-[200px]"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                      <span className="text-[10px] text-text-secondary line-clamp-1">
                        {c.desc}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-subtle border border-border text-text-secondary">
                      {c.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.badgeStyle}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`}
                      />
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text font-mono text-[11px]">
                    {c.pipelines} tables
                  </td>
                  <td className="py-3 px-4 text-text-secondary text-[11px]">
                    {formatRelativeTime(c.lastSyncedAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end">
                      <ActionMenu
                        ariaLabel={`Actions for ${c.name}`}
                        items={[
                          {
                            label: "Map Schema",
                            icon: <Layers className="w-4 h-4" />,
                            onClick: () =>
                              navigate({ to: "/connections/schema-map" }),
                          },
                          {
                            label: "View Pipeline",
                            icon: <ArrowRight className="w-4 h-4" />,
                            onClick: () =>
                              navigate({ to: "/connections/pipelines" }),
                          },
                          ...(c.id
                            ? [
                                {
                                  label: "Delete Connector",
                                  icon: <Trash2 className="w-4 h-4" />,
                                  destructive: true,
                                  dividerBefore: true,
                                  onClick: () => onDeleteConnector(c),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
