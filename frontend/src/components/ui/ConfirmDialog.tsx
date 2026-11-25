import React, { useRef } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Icons, ICON_SIZES } from "../../lib/icons";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  isLoading = false,
  errorMessage,
  onConfirm,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const iconCircle = (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
        isDestructive
          ? "bg-error-bg text-error border-error-border"
          : "bg-surface-subtle text-text-secondary border-border"
      }`}
    >
      {isDestructive ? (
        <Icons.Trash2 size={ICON_SIZES.card} aria-hidden="true" />
      ) : (
        <Icons.Info size={ICON_SIZES.card} aria-hidden="true" />
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      variant={isDestructive ? "destructive" : "confirm"}
      title={title}
      description={description}
      icon={iconCircle}
      preventClose={isLoading}
      initialFocusRef={isDestructive ? cancelBtnRef : undefined}
      statusMessage={isLoading ? `${confirmText}...` : undefined}
      footer={
        <>
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="secondary"
            size="sm"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "primary"}
            size="sm"
            isLoading={isLoading}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-error-border bg-error-bg px-3 py-2.5 text-xs text-error"
        >
          {errorMessage}
        </div>
      ) : null}
    </Dialog>
  );
};
