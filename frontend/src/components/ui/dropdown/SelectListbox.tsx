import React from "react";
import * as Popper from "@radix-ui/react-popper";
import * as Portal from "@radix-ui/react-portal";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { Check, ICON_SIZES } from "../../../lib/icons";
import { Tooltip } from "../Tooltip";
import type { SelectOption } from "./Select";

interface SelectListboxProps {
  options: SelectOption[];
  value: string;
  listboxId: string;
  triggerId: string;
  align: "start" | "center" | "end";
  matchTriggerWidth: boolean;
  panelClassName: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onDismiss: () => void;
  onSelect: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  setOpen: (open: boolean) => void;
}

export const SelectListbox: React.FC<SelectListboxProps> = ({
  options,
  value,
  listboxId,
  triggerId,
  align,
  matchTriggerWidth,
  panelClassName,
  contentRef,
  triggerRef,
  onDismiss,
  onSelect,
  onKeyDown,
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
            onKeyDown={onKeyDown}
            style={{
              minWidth: matchTriggerWidth
                ? "var(--radix-popper-anchor-width)"
                : undefined,
            }}
            className={[
              // Visual spec: radius 12px, 1px border token, layered soft shadow, 6px inner padding
              "z-[9999] rounded-xl border border-border bg-surface p-1.5",
              "shadow-lg shadow-black/10 dark:shadow-black/40",
              // Sizing spec: min-width equal to trigger, max-width 320px, max-height 320px with internal scroll
              "max-w-[320px] max-h-[320px] overflow-y-auto",
              // Animation: 120ms fade plus 4px slide
              "animate-dropdown-in outline-none select-none",
              panelClassName,
            ].join(" ")}
          >
            {options.length === 0 ? (
              <div className="py-4 text-center text-xs text-text-muted">
                No options available
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                const itemNode = (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    tabIndex={opt.disabled ? -1 : 0}
                    onClick={() => !opt.disabled && onSelect(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!opt.disabled) onSelect(opt.value);
                      }
                    }}
                    className={[
                      // Visual spec: 36px tall, 8px radius, 10px gap, 14px label
                      "w-full h-9 min-h-[40px] sm:min-h-[36px] px-2.5 rounded-lg flex items-center justify-between gap-2.5",
                      "text-sm font-medium transition-colors text-left cursor-pointer",
                      // Hover and keyboard focus
                      "hover:bg-surface-hover focus:bg-surface-hover focus:outline-none",
                      // Selected: accent-tinted bg, accent text & icon
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
                      {opt.icon && (
                        <span
                          className={`w-4 h-4 shrink-0 flex items-center justify-center ${
                            isSelected ? "text-primary" : "text-text-secondary"
                          }`}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.hint && (
                        <span className="text-xs text-text-muted">
                          {opt.hint}
                        </span>
                      )}
                      {isSelected && (
                        <Check
                          size={ICON_SIZES.dropdown}
                          className="text-primary shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
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
          </Popper.Content>
        </FocusScope>
      </DismissableLayer>
    </Portal.Root>
  );
};
