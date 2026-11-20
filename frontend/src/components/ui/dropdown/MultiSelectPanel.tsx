import React from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import {
  Check,
  Search,
  X,
  CheckSquare,
  Square,
  MinusSquare,
} from "../../../lib/icons";
import { Tooltip } from "../Tooltip";
import type { MultiSelectOption } from "./MultiSelect";

interface MultiSelectPanelProps {
  filteredOptions: MultiSelectOption[];
  options: MultiSelectOption[];
  values: string[];
  onToggle: (val: string) => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  activeCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchPlaceholder: string;
  showSearch: boolean;
  showSelectAll: boolean;
  onClearSearch: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  listboxId: string;
  triggerId: string;
  align: "start" | "center" | "end";
  matchTriggerWidth: boolean;
  panelClassName: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onDismiss: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  setOpen: (o: boolean) => void;
}

export const MultiSelectPanel: React.FC<MultiSelectPanelProps> = ({
  filteredOptions,
  options,
  values,
  onToggle,
  onSelectAll,
  isAllSelected,
  isPartiallySelected,
  activeCount,
  searchQuery,
  setSearchQuery,
  searchPlaceholder,
  showSearch,
  showSelectAll,
  onClearSearch,
  searchInputRef,
  listboxId,
  triggerId,
  align,
  matchTriggerWidth,
  panelClassName,
  contentRef,
  onKeyDown,
  onDismiss,
  triggerRef,
  setOpen,
}) => {
  return (
    <Portal.Root>
      <DismissableLayer
        onDismiss={onDismiss}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onDismiss();
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
            onKeyDown={onKeyDown}
            style={{
              minWidth: matchTriggerWidth
                ? "var(--radix-popper-anchor-width)"
                : "240px",
            }}
            className={[
              "z-[9999] rounded-xl border border-border bg-surface p-1.5",
              "shadow-lg shadow-black/10 dark:shadow-black/40",
              "max-w-[320px] max-h-[320px] overflow-hidden flex flex-col",
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
                      onClick={onClearSearch}
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
            {showSelectAll && filteredOptions.length > 0 && !searchQuery && (
              <div className="px-1 py-0.5 shrink-0">
                <button
                  type="button"
                  data-multiselect-action="select-all"
                  onClick={onSelectAll}
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
                      onClick={onClearSearch}
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
                      onClick={() => !opt.disabled && onToggle(opt.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!opt.disabled) onToggle(opt.value);
                        }
                      }}
                      className={[
                        "w-full h-9 min-h-[40px] sm:min-h-[36px] px-2.5 rounded-lg flex items-center justify-between gap-2.5",
                        "text-sm font-medium transition-colors text-left cursor-pointer",
                        "hover:bg-surface-hover focus:bg-surface-hover focus:outline-none",
                        isSelected
                          ? "bg-primary-tint text-primary font-semibold"
                          : "text-text hover:text-text",
                        opt.disabled
                          ? "opacity-50 cursor-not-allowed pointer-events-none"
                          : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
  );
};
