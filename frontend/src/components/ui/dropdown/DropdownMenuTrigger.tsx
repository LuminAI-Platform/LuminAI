import React from "react";
import * as Popper from "@radix-ui/react-popper";
import { Slot } from "@radix-ui/react-slot";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { ChevronDown, Loader2, ICON_SIZES } from "../../../lib/icons";
import { useDropdownMenu } from "./DropdownMenuContext";

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
