import React, { useState, useRef, useId, useCallback, useEffect } from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { ChevronDown, Loader2, ICON_SIZES } from "../../../lib/icons";
import { SelectOptionRow } from "./SelectOptionRow";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
  hint?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  size?: "sm" | "md";
  matchTriggerWidth?: boolean;
  align?: "start" | "center" | "end";
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select an option…",
  disabled = false,
  isLoading = false,
  id,
  name,
  ariaLabel,
  className = "",
  triggerClassName = "",
  panelClassName = "",
  size = "md",
  matchTriggerWidth = true,
  align = "start",
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const uniqueId = useId();
  const triggerId = id || `select-trigger-${uniqueId}`;
  const listboxId = `select-listbox-${uniqueId}`;

  const selectedOption = options.find((opt) => opt.value === value);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleListboxKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ) || [],
    );
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement,
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
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

  useEffect(() => {
    if (open && contentRef.current) {
      const selectedEl = contentRef.current.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]',
      );
      if (selectedEl) {
        selectedEl.focus();
      } else {
        const firstEl = contentRef.current.querySelector<HTMLElement>(
          '[role="option"]:not([aria-disabled="true"])',
        );
        firstEl?.focus();
      }
    }
  }, [open]);

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}

      <Popper.Root>
        <Popper.Anchor asChild>
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-label={ariaLabel || selectedOption?.label || placeholder}
            disabled={disabled || isLoading}
            onClick={() => !disabled && !isLoading && setOpen((prev) => !prev)}
            onKeyDown={handleTriggerKeyDown}
            className={[
              size === "sm"
                ? "h-8 min-h-[32px] px-2.5 text-xs"
                : "h-9 min-h-[40px] sm:min-h-[36px] px-3 text-xs sm:text-sm",
              "w-full inline-flex items-center justify-between gap-2 rounded-lg select-none cursor-pointer transition-colors",
              "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-focus",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-border-focus",
              disabled
                ? "opacity-50 cursor-not-allowed pointer-events-none"
                : "",
              triggerClassName,
            ].join(" ")}
          >
            <span className="flex items-center gap-2 truncate">
              {selectedOption?.icon && (
                <span className="w-4 h-4 shrink-0 text-text-secondary flex items-center justify-center">
                  {selectedOption.icon}
                </span>
              )}
              <span
                className={
                  selectedOption
                    ? "text-text font-medium truncate"
                    : "text-text-muted truncate"
                }
              >
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </span>

            {isLoading ? (
              <Loader2
                size={ICON_SIZES.inline}
                className="text-text-secondary animate-spin motion-reduce:animate-none shrink-0"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                size={ICON_SIZES.inline}
                aria-hidden="true"
                className={`text-text-secondary shrink-0 transition-transform duration-150 ${
                  open ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
        </Popper.Anchor>

        {open && (
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
                  ref={contentRef}
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={triggerId}
                  side="bottom"
                  align={align}
                  sideOffset={6}
                  avoidCollisions
                  collisionPadding={8}
                  onKeyDown={handleListboxKeyDown}
                  style={{
                    minWidth: matchTriggerWidth
                      ? "var(--radix-popper-anchor-width)"
                      : undefined,
                  }}
                  className={[
                    "z-[9999] rounded-xl border border-border bg-surface p-1.5",
                    "shadow-lg shadow-black/10 dark:shadow-black/40",
                    "max-w-[320px] max-h-[320px] overflow-y-auto",
                    "animate-dropdown-in outline-none select-none",
                    panelClassName,
                  ].join(" ")}
                >
                  {options.length === 0 ? (
                    <div className="py-4 text-center text-xs text-text-muted">
                      No options available
                    </div>
                  ) : (
                    options.map((opt) => (
                      <SelectOptionRow
                        key={opt.value}
                        opt={opt}
                        isSelected={opt.value === value}
                        onSelect={handleSelect}
                      />
                    ))
                  )}
                </Popper.Content>
              </FocusScope>
            </DismissableLayer>
          </Portal.Root>
        )}
      </Popper.Root>
    </div>
  );
};
