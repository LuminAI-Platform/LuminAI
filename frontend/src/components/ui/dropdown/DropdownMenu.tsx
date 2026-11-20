import React, { useState, useRef, useId, useCallback } from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { Slot } from "@radix-ui/react-slot";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { ChevronDown, Loader2, ICON_SIZES } from "../../../lib/icons";
import {
  DropdownMenuContext,
  useDropdownMenu,
} from "./DropdownMenuContext";

export { useDropdownMenu, DropdownMenuContext };
export * from "./DropdownMenuItems";

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

export interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
                  "inline-flex items-center justify-between gap-2 px-3 h-9 min-h-[36px]",
                  "text-xs font-semibold rounded-lg select-none cursor-pointer transition-colors",
                  "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-focus",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-border-focus",
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

export interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  alignOffset?: number;
  matchTriggerWidth?: boolean;
  portalled?: boolean;
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
      portalled = true,
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

    const handleDismiss = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };

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

    const content = (
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
              "z-[9999] rounded-xl border border-border bg-surface p-1.5",
              "shadow-lg shadow-black/10 dark:shadow-black/40",
              "w-max min-w-[180px] max-w-[320px] max-h-[320px] overflow-y-auto",
              "animate-dropdown-in outline-none select-none",
              className,
            ].join(" ")}
            {...props}
          >
            {children}
          </Popper.Content>
        </FocusScope>
      </DismissableLayer>
    );

    return portalled ? <Portal.Root>{content}</Portal.Root> : content;
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";
