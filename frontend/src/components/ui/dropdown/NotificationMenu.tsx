import React from "react";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Tooltip } from "../Tooltip";
import { Bell, CheckCheck, Trash2, ICON_SIZES } from "../../../lib/icons";

export const NotificationMenu: React.FC = () => {
  return (
    <DropdownMenuRoot>
      <Tooltip label="Notifications" side="bottom">
        <DropdownMenuTrigger asChild aria-label="Notifications">
          <button
            type="button"
            aria-label="Notifications"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors relative cursor-pointer h-9 w-9 border border-transparent hover:border-border"
          >
            <Bell size={ICON_SIZES.header} aria-hidden="true" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" side="bottom" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Notifications
          </span>
          <span className="text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded bg-primary-tint">
            2 new
          </span>
        </div>

        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          <div className="p-2 rounded-lg bg-surface-subtle/70 border border-border/60 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between font-semibold text-text">
              <span>Pipeline Sync Completed</span>
              <span className="text-[10px] text-text-muted font-normal">
                2m ago
              </span>
            </div>
            <p className="text-[11px] text-text-secondary leading-snug">
              PostgreSQL master sync ingested 2,450 records into Customer
              entity.
            </p>
          </div>

          <div className="p-2 rounded-lg bg-surface-subtle/70 border border-border/60 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between font-semibold text-text">
              <span>Schema Mapping Ready</span>
              <span className="text-[10px] text-text-muted font-normal">
                14m ago
              </span>
            </div>
            <p className="text-[11px] text-text-secondary leading-snug">
              AI suggested 6 entity relationships with high confidence.
            </p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between pt-0.5 px-1">
          <button
            type="button"
            onClick={() => {}}
            className="text-[11px] text-text-secondary hover:text-text font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <CheckCheck size={ICON_SIZES.inline} aria-hidden="true" /> Mark all
            read
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="text-[11px] text-text-muted hover:text-error font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 size={ICON_SIZES.inline} aria-hidden="true" /> Clear
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
