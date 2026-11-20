import React, { useState, useRef, useId, useCallback, useMemo } from "react";
import * as Popper from "@radix-ui/react-popper";
import { ChevronDown, Loader2 } from "../../../lib/icons";
import { MultiSelectPanel } from "./MultiSelectPanel";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
}

export interface MultiSelectProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showSelectAll?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  matchTriggerWidth?: boolean;
  align?: "start" | "center" | "end";
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  values,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search…",
  showSearch = true,
  showSelectAll = true,
  disabled = false,
  isLoading = false,
  id,
  className = "",
  triggerClassName = "",
  panelClassName = "",
  matchTriggerWidth = false,
  align = "start",
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const uniqueId = useId();
  const triggerId = id || `multiselect-trigger-${uniqueId}`;
  const listboxId = `multiselect-listbox-${uniqueId}`;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const activeCount = values.length;
  const isAllSelected =
    options.length > 0 && options.every((opt) => values.includes(opt.value));
  const isPartiallySelected = values.length > 0 && !isAllSelected;

  const handleDismiss = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
    triggerRef.current?.focus();
  }, []);

  const handleToggle = (optValue: string) => {
    const isSelected = values.includes(optValue);
    if (isSelected) {
      onChange(values.filter((v) => v !== optValue));
    } else {
      onChange([...values, optValue]);
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      const allSelectable = options
        .filter((opt) => !opt.disabled)
        .map((opt) => opt.value);
      onChange(allSelectable);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleListboxKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleDismiss();
      return;
    }

    if (e.key === "Tab") {
      setOpen(false);
      return;
    }

    const items = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"]), [data-multiselect-action]',
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
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
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
            aria-label={`${label}${activeCount > 0 ? `, ${activeCount} selected` : ""}`}
            disabled={disabled || isLoading}
            onClick={() => !disabled && !isLoading && setOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (disabled || isLoading) return;
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={[
              "h-9 min-h-[40px] sm:min-h-[36px] px-3 rounded-lg flex items-center justify-between gap-2.5",
              "text-xs sm:text-sm font-medium select-none cursor-pointer transition-colors",
              "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-focus",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-border-focus",
              disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
              triggerClassName,
            ].join(" ")}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-text font-medium">{label}</span>
              {activeCount > 0 ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-tint text-primary border border-primary-border">
                  {activeCount}
                </span>
              ) : placeholder ? (
                <span className="text-text-muted text-xs font-normal">
                  {placeholder}
                </span>
              ) : null}
            </div>

            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-text-secondary animate-spin shrink-0" />
            ) : (
              <ChevronDown
                className={`w-3.5 h-3.5 text-text-secondary shrink-0 transition-transform duration-150 ${
                  open ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
        </Popper.Anchor>

        {open && (
          <MultiSelectPanel
            filteredOptions={filteredOptions}
            options={options}
            values={values}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            isAllSelected={isAllSelected}
            isPartiallySelected={isPartiallySelected}
            activeCount={activeCount}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchPlaceholder={searchPlaceholder}
            showSearch={showSearch}
            showSelectAll={showSelectAll}
            onClearSearch={handleClearSearch}
            searchInputRef={searchInputRef}
            listboxId={listboxId}
            triggerId={triggerId}
            align={align}
            matchTriggerWidth={matchTriggerWidth}
            panelClassName={panelClassName}
            contentRef={contentRef}
            onKeyDown={handleListboxKeyDown}
            onDismiss={handleDismiss}
            triggerRef={triggerRef}
            setOpen={setOpen}
          />
        )}
      </Popper.Root>
    </div>
  );
};
