import React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X, ICON_SIZES } from "../../lib/icons";
import { Tooltip } from "./Tooltip";

export type DialogVariant = "form" | "confirm" | "destructive";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: DialogVariant;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  footerStart?: React.ReactNode;
  trigger?: React.ReactNode;
  className?: string;
  preventClose?: boolean;
  onRequestClose?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  statusMessage?: string;
  hideCloseButton?: boolean;
}

const VARIANT_WIDTH: Record<DialogVariant, string> = {
  confirm: "max-w-[440px]",
  destructive: "max-w-[440px]",
  form: "max-w-[520px]",
};

/**
 * Unified Dialog component for form, confirm, and destructive flows.
 * Portal-rendered on document.body with standardized 24px padding, 16px section
 * spacing, 12px footer button gap, 12px radius, focus trap, Escape handling,
 * and automatic focus restoration.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  variant = "confirm",
  title,
  description,
  icon,
  children,
  footer,
  footerStart,
  trigger,
  className = "",
  preventClose = false,
  onRequestClose,
  initialFocusRef,
  statusMessage,
  hideCloseButton = false,
}) => {
  const handleDismiss = () => {
    if (preventClose) return;
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleDismiss();
      return;
    }
    onOpenChange(true);
  };

  const portalContainer =
    typeof document !== "undefined" ? document.body : undefined;

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal container={portalContainer}>
        <RadixDialog.Overlay className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-xs animate-dialog-backdrop" />
        <RadixDialog.Content
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (preventClose) {
              event.preventDefault();
              return;
            }
            if (onRequestClose) {
              event.preventDefault();
              onRequestClose();
            }
          }}
          onPointerDownOutside={(event) => {
            if (preventClose) {
              event.preventDefault();
              return;
            }
            if (onRequestClose) {
              event.preventDefault();
              onRequestClose();
            }
          }}
          onInteractOutside={(event) => {
            if (preventClose) {
              event.preventDefault();
            }
          }}
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] ${VARIANT_WIDTH[variant]} bg-surface border border-border rounded-xl shadow-lg z-[99999] focus:outline-none animate-dialog-content flex flex-col gap-4 p-6 max-h-[90vh] overflow-hidden ${className}`}
        >
          {/* Screen-reader live status region for loading/saving feedback */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {statusMessage ?? ""}
          </div>

          {/* Header with bottom divider */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-border shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
              <div className="min-w-0">
                <RadixDialog.Title className="text-base font-semibold text-text leading-snug">
                  {title}
                </RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className="text-xs text-text-secondary mt-1 leading-relaxed">
                    {description}
                  </RadixDialog.Description>
                ) : (
                  <RadixDialog.Description className="sr-only">
                    Dialog content
                  </RadixDialog.Description>
                )}
              </div>
            </div>

            {!hideCloseButton && (
              <Tooltip label="Close dialog" side="left">
                <button
                  type="button"
                  disabled={preventClose}
                  onClick={handleDismiss}
                  className="text-text-secondary hover:text-text p-1.5 -mt-1 -mr-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label="Close dialog"
                >
                  <X size={ICON_SIZES.dropdown} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Body */}
          {children && (
            <div className="flex-1 overflow-y-auto text-sm text-text-secondary">
              {children}
            </div>
          )}

          {/* Footer */}
          {(footer || footerStart) && (
            <div
              className={`flex flex-wrap items-center gap-3 shrink-0 ${
                footerStart ? "justify-between" : "justify-end"
              }`}
            >
              {footerStart && (
                <div className="flex items-center gap-3">{footerStart}</div>
              )}
              {footer && (
                <div className="flex items-center justify-end gap-3 ml-auto">
                  {footer}
                </div>
              )}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
