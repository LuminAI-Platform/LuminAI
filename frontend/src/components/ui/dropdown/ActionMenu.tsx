import React from "react";
import { MoreVertical, MoreHorizontal } from "lucide-react";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
  rightSlot?: React.ReactNode;
  dividerBefore?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  trigger?: React.ReactNode;
  orientation?: "vertical" | "horizontal";
  ariaLabel?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  trigger,
  orientation = "horizontal",
  ariaLabel = "Actions",
  align = "end",
  className = "",
}) => {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild aria-label={ariaLabel}>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className={`p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-subtle transition-colors cursor-pointer border border-transparent hover:border-border ${className}`}
            aria-label={ariaLabel}
          >
            {orientation === "vertical" ? (
              <MoreVertical className="w-4 h-4" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} side="bottom" className="w-48">
        {items.map((item, idx) => (
          <React.Fragment key={item.label || idx}>
            {item.dividerBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              icon={item.icon}
              destructive={item.destructive}
              disabled={item.disabled}
              disabledTooltip={item.disabledTooltip}
              rightSlot={item.rightSlot}
              onClick={item.onClick}
            >
              {item.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
