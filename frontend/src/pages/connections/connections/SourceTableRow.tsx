import React from "react";
import {
  Database,
  FileText,
  Layers,
  Search,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Play,
  PenLine,
  Clock,
} from "../../../lib/icons";
import { ActionMenu } from "../../../components/ui/dropdown";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  type UnifiedSource,
  type IngestedFile,
  formatRelativeTime,
  formatExactTimestamp,
  getHealthStatusBadge,
} from "./connectionsTypes";

interface SourceTableRowProps {
  source: UnifiedSource;
  testingSourceId: string | null;
  togglingSourceId: string | null;
  onTestConnection: (source: UnifiedSource) => void;
  onEditSource: (source: UnifiedSource) => void;
  onTogglePause: (source: UnifiedSource) => void;
  onDeleteSource: (source: UnifiedSource) => void;
  onOpenRawPreview: (file: IngestedFile) => void;
  onInspectCleanData: (file: IngestedFile) => void;
  onOpenSchemaStudio: () => void;
}

export const SourceTableRow: React.FC<SourceTableRowProps> = ({
  source,
  testingSourceId,
  togglingSourceId,
  onTestConnection,
  onEditSource,
  onTogglePause,
  onDeleteSource,
  onOpenRawPreview,
  onInspectCleanData,
  onOpenSchemaStudio,
}) => {
  const statusCfg = getHealthStatusBadge(source.status);
  const isBusy =
    testingSourceId === source.id || togglingSourceId === source.id;

  const menuItems =
    source.category === "database"
      ? [
          {
            label:
              testingSourceId === source.id
                ? "Testing connection..."
                : "Test connection",
            icon: <Play className="w-4 h-4" />,
            disabled: isBusy,
            onClick: () => onTestConnection(source),
          },
          {
            label: "Edit",
            icon: <PenLine className="w-4 h-4" />,
            disabled: isBusy,
            onClick: () => onEditSource(source),
          },
          {
            label: source.status === "Paused" ? "Resume" : "Pause",
            icon: <Clock className="w-4 h-4" />,
            disabled: isBusy,
            onClick: () => onTogglePause(source),
          },
          {
            label: "Open in Schema Studio",
            icon: <Layers className="w-4 h-4" />,
            onClick: onOpenSchemaStudio,
          },
          {
            label: "Delete",
            icon: <Trash2 className="w-4 h-4" />,
            destructive: true,
            dividerBefore: true,
            onClick: () => onDeleteSource(source),
          },
        ]
      : [
          ...(source.fileRef
            ? [
                {
                  label: "Inspect raw data",
                  icon: <Search className="w-4 h-4" />,
                  onClick: () => onOpenRawPreview(source.fileRef!),
                },
                {
                  label: "Inspect clean data",
                  icon: <ShieldCheck className="w-4 h-4 text-success" />,
                  onClick: () => onInspectCleanData(source.fileRef!),
                },
              ]
            : []),
          {
            label: "Edit",
            icon: <PenLine className="w-4 h-4" />,
            disabled: isBusy,
            onClick: () => onEditSource(source),
          },
          {
            label: source.status === "Paused" ? "Resume" : "Pause",
            icon: <Clock className="w-4 h-4" />,
            disabled: isBusy,
            onClick: () => onTogglePause(source),
          },
          {
            label: "Delete",
            icon: <Trash2 className="w-4 h-4" />,
            destructive: true,
            dividerBefore: true,
            onClick: () => onDeleteSource(source),
          },
        ];

  return (
    <tr className="hover:bg-surface-hover transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary shrink-0">
            {source.category === "database" ? (
              <Database className="w-4 h-4" aria-hidden="true" />
            ) : (
              <FileText className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="font-semibold text-text truncate max-w-[220px]"
                title={source.name}
              >
                {source.name}
              </span>
              {source.schemaDriftWarning && (
                <Tooltip label={source.schemaDriftWarning} side="top">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-bg text-warning border border-warning-border shrink-0">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    Schema drift
                  </span>
                </Tooltip>
              )}
            </div>
            {source.desc && (
              <span className="text-[11px] text-text-secondary line-clamp-1">
                {source.desc}
              </span>
            )}
            {source.size && source.size !== "—" && (
              <span className="text-[11px] text-text-secondary">
                {source.size}
              </span>
            )}
          </div>
        </div>
      </td>

      <td className="py-3 px-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-subtle border border-border text-text-secondary">
          {source.typeLabel}
        </span>
      </td>

      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusCfg.badgeStyle}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
          {source.status}
        </span>
      </td>

      <td className="py-3 px-4 text-text-secondary">
        <Tooltip label={formatExactTimestamp(source.lastSyncAt)} side="top">
          <span className="cursor-default underline decoration-dotted decoration-border underline-offset-2">
            {formatRelativeTime(source.lastSyncAt)}
          </span>
        </Tooltip>
      </td>

      <td className="py-3 px-4 text-text tabular-nums">
        {typeof source.rowsSynced === "number"
          ? source.rowsSynced.toLocaleString()
          : "—"}
      </td>

      <td className="py-3 px-4 text-right">
        <div className="inline-flex items-center justify-end">
          <ActionMenu
            ariaLabel={`Actions for ${source.name}`}
            items={menuItems}
          />
        </div>
      </td>
    </tr>
  );
};
