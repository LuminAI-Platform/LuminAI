import React, { useState, useRef, useId, useCallback, useEffect } from "react";
import * as Popper from "@radix-ui/react-popper";
import { ChevronDown, Loader2, ICON_SIZES } from "../../../lib/icons";
import { SelectListbox } from "./SelectListbox";

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

  // Return focus to trigger on close
  const handleDismiss = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation for trigger
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

  // Keyboard navigation for listbox
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

  // Auto-focus selected (enabled) item when opening
  useEffect(() => {
    if (open && contentRef.current) {
      const selectedEl = contentRef.current.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]:not([aria-disabled="true"])',
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
      {/* Hidden input for form submissions */}
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
              // Sizing & layout matching buttons: 36px tall (h-9)
              size === "sm"
                ? "h-8 min-h-[32px] px-2.5 text-xs"
                : "h-9 min-h-[40px] sm:min-h-[36px] px-3 text-xs sm:text-sm",
              "w-full inline-flex items-center justify-between gap-2 rounded-lg select-none cursor-pointer transition-colors",
              // Visual styling: surface, border, text
              "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-focus",
              // Focus ring
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-border-focus",
              // Disabled state
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
          <SelectListbox
            options={options}
            value={value}
            listboxId={listboxId}
            triggerId={triggerId}
            align={align}
            matchTriggerWidth={matchTriggerWidth}
            panelClassName={panelClassName}
            contentRef={contentRef}
            triggerRef={triggerRef}
            onDismiss={handleDismiss}
            onSelect={handleSelect}
            onKeyDown={handleListboxKeyDown}
            setOpen={setOpen}
          />
        )}
      </Popper.Root>
    </div>
  );
};
