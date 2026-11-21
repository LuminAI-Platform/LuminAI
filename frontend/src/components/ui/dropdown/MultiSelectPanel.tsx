import React from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import {
  Search,
  X,
  CheckSquare,
  Square,
  MinusSquare,
} from "../../../lib/icons";
import type { MultiSelectOption } from "./MultiSelect";
import { MultiSelectOptionItem } from "./MultiSelectOptionItem";

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
                filteredOptions.map((opt) => (
                  <MultiSelectOptionItem
                    key={opt.value}
                    option={opt}
                    isSelected={values.includes(opt.value)}
                    onToggle={onToggle}
                  />
                ))
              )}
            </div>
          </Popper.Content>
        </FocusScope>
      </DismissableLayer>
    </Portal.Root>
  );
};
