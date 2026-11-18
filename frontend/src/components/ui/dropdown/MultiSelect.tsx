import React, { useState, useRef, useId, useCallback, useMemo } from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import {
  ChevronDown,
  Check,
  Search,
  X,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import { Tooltip } from "../Tooltip";

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

  // Filter options based on search query
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
      // Select all non-disabled options
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

  // Keyboard navigation within listbox
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
              // Sizing spec: 36px tall (h-9) matching buttons
              "h-9 min-h-[40px] sm:min-h-[36px] px-3 rounded-lg flex items-center justify-between gap-2.5",
              "text-xs sm:text-sm font-medium select-none cursor-pointer transition-colors",
              // Visual styling
              "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-focus",
              // Focus ring
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-border-focus",
              // Disabled
              disabled
                ? "opacity-50 cursor-not-allowed pointer-events-none"
                : "",
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
                  setSearchQuery("");
                }
              }}
            >
              <FocusScope trapped={false} loop>
                <Popper.Content
                  ref={contentRef}
                  id={listboxId}
                  role="listbox"
                  aria-multiselectable="true"
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
                      : "240px",
                  }}
                  className={[
                    // Visual spec: radius 12px, 1px border token, layered soft shadow, 6px inner padding
                    "z-[9999] rounded-xl border border-border bg-surface p-1.5",
                    "shadow-lg shadow-black/10 dark:shadow-black/40",
                    // Sizing spec: max-width 320px, max-height 320px with internal scroll
                    "max-w-[320px] max-h-[320px] overflow-hidden flex flex-col",
                    // Animation: 120ms fade plus 4px slide
                    "animate-dropdown-in outline-none select-none",
                    panelClassName,
                  ].join(" ")}
                >
                  {/* Search input field */}
                  {showSearch && (
                    <div className="relative px-1 pt-1 pb-1.5 shrink-0">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-border focus-within:border-border-focus transition-colors">
                        <Search className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={searchPlaceholder}
                          autoFocus
                          className="w-full bg-transparent border-none outline-none text-xs text-text placeholder:text-text-muted"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="p-0.5 text-text-secondary hover:text-text rounded transition-colors cursor-pointer"
                            aria-label="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Select All action row */}
                  {showSelectAll &&
                    filteredOptions.length > 0 &&
                    !searchQuery && (
                      <div className="px-1 py-0.5 shrink-0">
                        <button
                          type="button"
                          data-multiselect-action="select-all"
                          onClick={handleSelectAll}
                          className="w-full h-8 px-2 rounded-lg flex items-center justify-between text-xs font-semibold text-text-secondary hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            {isAllSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            ) : isPartiallySelected ? (
                              <MinusSquare className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-text-secondary" />
                            )}
                            <span>Select all</span>
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {activeCount} of {options.length}
                          </span>
                        </button>
                        <div className="h-px bg-border my-1 -mx-1" />
                      </div>
                    )}

                  {/* Options list with internal scroll */}
                  <div className="overflow-y-auto max-h-[220px] flex flex-col gap-0.5 px-0.5">
                    {filteredOptions.length === 0 ? (
                      <div className="py-6 text-center flex flex-col items-center justify-center gap-1.5 text-xs text-text-muted">
                        <span>No matches</span>
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredOptions.map((opt) => {
                        const isSelected = values.includes(opt.value);

                        const itemNode = (
                          <div
                            key={opt.value}
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={opt.disabled}
                            tabIndex={opt.disabled ? -1 : 0}
                            onClick={() =>
                              !opt.disabled && handleToggle(opt.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!opt.disabled) handleToggle(opt.value);
                              }
                            }}
                            className={[
                              // Visual spec: 36px tall, 8px radius, 10px gap, 14px label
                              "w-full h-9 min-h-[40px] sm:min-h-[36px] px-2.5 rounded-lg flex items-center justify-between gap-2.5",
                              "text-sm font-medium transition-colors text-left cursor-pointer",
                              // Hover & focus
                              "hover:bg-surface-hover focus:bg-surface-hover focus:outline-none",
                              // Selected: accent-tinted background, accent text & icon
                              isSelected
                                ? "bg-primary-tint text-primary font-semibold"
                                : "text-text hover:text-text",
                              // Disabled
                              opt.disabled
                                ? "opacity-50 cursor-not-allowed pointer-events-none"
                                : "",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Checkbox box */}
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-primary border-primary text-primary-text"
                                    : "bg-surface border-border text-transparent"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                )}
                              </div>

                              {opt.icon && (
                                <span
                                  className={`w-4 h-4 shrink-0 flex items-center justify-center ${
                                    isSelected
                                      ? "text-primary"
                                      : "text-text-secondary"
                                  }`}
                                >
                                  {opt.icon}
                                </span>
                              )}

                              <span className="truncate">{opt.label}</span>
                            </div>

                            {/* Count badge */}
                            {opt.count !== undefined && (
                              <span
                                className={`text-[11px] font-mono px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-primary/20 text-primary font-bold"
                                    : "bg-surface-subtle text-text-secondary"
                                }`}
                              >
                                {opt.count}
                              </span>
                            )}
                          </div>
                        );

                        if (opt.disabled && opt.disabledTooltip) {
                          return (
                            <Tooltip
                              key={opt.value}
                              label={opt.disabledTooltip}
                              side="right"
                            >
                              <div className="w-full">{itemNode}</div>
                            </Tooltip>
                          );
                        }

                        return itemNode;
                      })
                    )}
                  </div>
                </Popper.Content>
              </FocusScope>
            </DismissableLayer>
          </Portal.Root>
        )}
      </Popper.Root>
    </div>
  );
};
