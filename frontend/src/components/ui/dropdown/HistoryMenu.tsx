import React from "react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Tooltip } from "../Tooltip";
import { Icons, ExternalLink, ICON_SIZES } from "../../../lib/icons";

export const HistoryMenu: React.FC = () => {
  return (
    <DropdownMenuRoot>
      <Tooltip label="Recent activity" side="bottom">
        <DropdownMenuTrigger asChild aria-label="Recent activity">
          <button
            type="button"
            aria-label="Recent activity"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer h-9 w-9 border border-transparent hover:border-border"
          >
            <Icons.History size={ICON_SIZES.header} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" side="bottom" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Recent Activity
          </span>
          <span className="text-[10px] text-text-muted">Today</span>
        </div>

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          <Link
            to="/connections/pipelines"
            className="p-2 rounded-lg hover:bg-surface-hover flex flex-col gap-0.5 text-xs transition-colors"
          >
            <span className="font-semibold text-text truncate">
              Pipeline Run #1042
            </span>
            <span className="text-[11px] text-text-secondary">
              Telemetry verified for Postgres connector
            </span>
          </Link>

          <Link
            to="/connections/schema-map"
            className="p-2 rounded-lg hover:bg-surface-hover flex flex-col gap-0.5 text-xs transition-colors"
          >
            <span className="font-semibold text-text truncate">
              Schema Map Updated
            </span>
            <span className="text-[11px] text-text-secondary">
              Merged 3 properties in Transaction schema
            </span>
          </Link>
        </div>

        <DropdownMenuSeparator />

        <div className="pt-0.5 px-1">
          <Link
            to="/connections/pipelines"
            className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View execution logs</span>
            <ExternalLink size={ICON_SIZES.inline} aria-hidden="true" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
