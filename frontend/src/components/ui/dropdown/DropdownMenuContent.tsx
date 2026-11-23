import React, { useRef } from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { useDropdownMenu } from "./DropdownMenuContext";

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
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
