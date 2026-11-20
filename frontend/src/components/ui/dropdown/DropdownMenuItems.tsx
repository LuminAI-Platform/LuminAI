import React from "react";
import { Tooltip } from "../Tooltip";
import { useDropdownMenu } from "./DropdownMenuContext";

/* ==========================================================================
   DropdownMenuItem
   ========================================================================== */

export interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  destructive?: boolean;
  selected?: boolean;
  disabledTooltip?: string;
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps
>(
  (
    {
      children,
      icon,
      rightSlot,
      destructive = false,
      selected = false,
      disabledTooltip,
      disabled = false,
      className = "",
      onClick,
      ...props
    },
    ref,
  ) => {
    const { setOpen, triggerRef } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(e);
      if (!e.defaultPrevented) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const itemNode = (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        aria-disabled={disabled}
        disabled={disabled}
        onClick={handleClick}
        className={[
          "w-full h-9 min-h-[40px] sm:min-h-[36px] px-2.5 rounded-lg flex items-center gap-2.5",
          "text-sm font-medium transition-colors text-left cursor-pointer",
          "focus:outline-none",
          destructive
            ? "text-error hover:bg-error-bg hover:text-error focus:bg-error-bg focus:text-error"
            : selected
              ? "bg-primary-tint text-primary font-semibold"
              : "text-text hover:bg-surface-hover hover:text-text focus:bg-surface-hover focus:text-text",
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
          className,
        ].join(" ")}
        {...props}
      >
        {icon && (
          <span
            className={`w-4 h-4 shrink-0 flex items-center justify-center ${
              destructive
                ? "text-error"
                : selected
                  ? "text-primary"
                  : "text-text-secondary"
            }`}
          >
            {icon}
          </span>
        )}
        <span className="truncate flex-1">{children}</span>
        {rightSlot && (
          <span className="shrink-0 text-xs text-text-muted flex items-center gap-1">
            {rightSlot}
          </span>
        )}
      </button>
    );

    if (disabled && disabledTooltip) {
      return (
        <Tooltip label={disabledTooltip} side="right">
          <div className="w-full">{itemNode}</div>
        </Tooltip>
      );
    }

    return itemNode;
  },
);
DropdownMenuItem.displayName = "DropdownMenuItem";

/* ==========================================================================
   DropdownMenuGroup & DropdownMenuLabel
   ========================================================================== */

export const DropdownMenuGroup: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ children, className = "", ...props }) => {
  return (
    <div
      role="group"
      className={`flex flex-col gap-0.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuLabel: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

/* ==========================================================================
   DropdownMenuSeparator
   ========================================================================== */

export const DropdownMenuSeparator: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className = "", ...props }) => {
  return (
    <div
      role="separator"
      className={`h-px bg-border my-1.5 -mx-1.5 ${className}`}
      {...props}
    />
  );
};

/* ==========================================================================
   DropdownMenuHeader
   ========================================================================== */

export interface DropdownMenuHeaderProps {
  avatar?: React.ReactNode;
  name: string;
  email?: string;
  className?: string;
}

export const DropdownMenuHeader: React.FC<DropdownMenuHeaderProps> = ({
  avatar,
  name,
  email,
  className = "",
}) => {
  return (
    <div
      className={`flex items-start gap-3 p-2.5 bg-surface-subtle/60 rounded-lg border border-border/60 mb-1 ${className}`}
    >
      {avatar && (
        <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center text-text text-xs font-bold shrink-0 select-none">
          {avatar}
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-semibold text-text truncate" title={name}>
          {name}
        </span>
        {email && (
          <span
            className="text-[11px] text-text-secondary truncate leading-snug mt-0.5"
            title={email}
          >
            {email}
          </span>
        )}
      </div>
    </div>
  );
};
