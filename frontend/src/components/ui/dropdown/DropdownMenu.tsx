import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useId,
  useCallback,
} from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { Slot } from "@radix-ui/react-slot";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { ChevronDown, Loader2, ICON_SIZES } from "../../../lib/icons";
import { Tooltip } from "../Tooltip";

/* ==========================================================================
   DropdownMenu Context
   ========================================================================== */

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentId: string;
  triggerId: string;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(
  null,
);

const useDropdownMenu = () => {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error(
      "DropdownMenu subcomponents must be used within DropdownMenuRoot",
    );
  }
  return context;
};

/* ==========================================================================
   1. DropdownMenuRoot
   ========================================================================== */

export interface DropdownMenuRootProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export const DropdownMenuRoot: React.FC<DropdownMenuRootProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const uniqueId = useId();
  const triggerId = `dropdown-trigger-${uniqueId}`;
  const contentId = `dropdown-content-${uniqueId}`;

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        contentId,
        triggerId,
      }}
    >
      <Popper.Root>{children}</Popper.Root>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenu = DropdownMenuRoot;

/* ==========================================================================
   2. DropdownMenuTrigger
   ========================================================================== */

export interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  showChevron?: boolean;
  isLoading?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>(
  (
    {
      children,
      className = "",
      asChild = false,
      showChevron = false,
      isLoading = false,
      onClick,
      onKeyDown,
      ...props
    },
    forwardedRef,
  ) => {
    const { open, setOpen, triggerRef, triggerId, contentId } =
      useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading || props.disabled) return;
      onClick?.(e);
      if (!e.defaultPrevented) {
        setOpen(!open);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (isLoading || props.disabled) return;
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
    };

    const composedRef = composeRefs(forwardedRef, triggerRef);
    const Comp = asChild ? Slot : "button";

    return (
      <Popper.Anchor asChild>
        <Comp
          ref={composedRef}
          id={triggerId}
          type={asChild ? undefined : "button"}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          disabled={props.disabled || isLoading}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={
            asChild
              ? className
              : [
                  // Base layout matching buttons
                  "inline-flex items-center justify-between gap-2 px-3 h-9 min-h-[36px]",
                  "text-xs font-semibold rounded-lg select-none cursor-pointer transition-colors",
                  // Border & surface
                  "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-focus",
                  // Focus ring
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-border-focus",
                  // Disabled
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  className,
                ].join(" ")
          }
          {...props}
        >
          {asChild ? (
            children
          ) : (
            <>
              <span className="truncate">{children}</span>
              {isLoading ? (
                <Loader2
                  size={ICON_SIZES.inline}
                  className="text-text-secondary animate-spin motion-reduce:animate-none shrink-0"
                  aria-hidden="true"
                />
              ) : showChevron ? (
                <ChevronDown
                  size={ICON_SIZES.inline}
                  aria-hidden="true"
                  className={`text-text-secondary shrink-0 transition-transform duration-150 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              ) : null}
            </>
          )}
        </Comp>
      </Popper.Anchor>
    );
  },
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/* ==========================================================================
   3. DropdownMenuContent
   ========================================================================== */

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  alignOffset?: number;
  matchTriggerWidth?: boolean;
}

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(
  (
    {
      children,
      className = "",
      align = "start",
      side = "bottom",
      sideOffset = 6,
      alignOffset = 0,
      matchTriggerWidth = false,
      onKeyDown,
      ...props
    },
    forwardedRef,
  ) => {
    const { open, setOpen, triggerRef, contentId, triggerId } =
      useDropdownMenu();
    const contentRef = useRef<HTMLDivElement | null>(null);

    const setRefs = (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    // Return focus to trigger on close
    const handleDismiss = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };

    // Keyboard navigation within the menu
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      const items = Array.from(
        contentRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) || [],
      );
      const currentIndex = items.findIndex(
        (item) => item === document.activeElement,
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[nextIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prevIndex]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    };

    if (!open) return null;

    return (
      <Portal.Root>
        <DismissableLayer
          onDismiss={handleDismiss}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleDismiss();
          }}
          onPointerDownOutside={(e) => {
            const target = e.detail.originalEvent.target as Node;
            if (triggerRef.current?.contains(target)) {
              e.preventDefault();
            } else {
              setOpen(false);
            }
          }}
        >
          <FocusScope trapped={false} loop>
            <Popper.Content
              ref={setRefs}
              id={contentId}
              role="menu"
              aria-labelledby={triggerId}
              side={side}
              align={align}
              sideOffset={sideOffset}
              alignOffset={alignOffset}
              avoidCollisions
              collisionPadding={8}
              onKeyDown={handleKeyDown}
              style={{
                minWidth: matchTriggerWidth
                  ? "var(--radix-popper-anchor-width)"
                  : undefined,
              }}
              className={[
                // Visual spec: radius 12px, 1px border, layered soft shadow, 6px padding
                "z-[9999] rounded-xl border border-border bg-surface p-1.5",
                "shadow-lg shadow-black/10 dark:shadow-black/40",
                // Sizing spec: max-width 320px, max-height 320px with internal scroll
                "w-max min-w-[180px] max-w-[320px] max-h-[320px] overflow-y-auto",
                // Animation: 120ms fade plus 4px slide
                "animate-dropdown-in outline-none select-none",
                className,
              ].join(" ")}
              {...props}
            >
              {children}
            </Popper.Content>
          </FocusScope>
        </DismissableLayer>
      </Portal.Root>
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

/* ==========================================================================
   4. DropdownMenuItem
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
          // Visual spec: 36px tall, 8px radius, 10px gap, 14px label
          "w-full h-9 min-h-[40px] sm:min-h-[36px] px-2.5 rounded-lg flex items-center gap-2.5",
          "text-sm font-medium transition-colors text-left cursor-pointer",
          // Focus and hover states
          "focus:outline-none",
          destructive
            ? "text-error hover:bg-error-bg hover:text-error focus:bg-error-bg focus:text-error"
            : selected
              ? "bg-primary-tint text-primary font-semibold"
              : "text-text hover:bg-surface-hover hover:text-text focus:bg-surface-hover focus:text-text",
          // Disabled state
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
   5. DropdownMenuGroup & DropdownMenuLabel
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
   6. DropdownMenuSeparator
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
   7. DropdownMenuHeader (specifically for User Menu Header)
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
