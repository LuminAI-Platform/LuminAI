import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const MAX_WIDTH_MAP = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

/**
 * Accessible Modal Dialog Component built on Radix UI Dialog
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  maxWidth = "md",
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 animate-in fade-in" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${MAX_WIDTH_MAP[maxWidth]} bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 z-50 focus:outline-none animate-in fade-in zoom-in-95`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
            <div>
              {title && (
                <Dialog.Title className="text-base font-semibold text-zinc-100">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="text-xs text-zinc-400 mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
