/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef, useId, useCallback } from "react";
import * as Popper from "@radix-ui/react-popper";
import { DropdownMenuContext, useDropdownMenu } from "./DropdownMenuContext";

export { useDropdownMenu, DropdownMenuContext };
export * from "./DropdownMenuItems";
export * from "./DropdownMenuTrigger";
export * from "./DropdownMenuContent";

export interface DropdownMenuRootProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export const DropdownMenuRoot: React.FC<DropdownMenuRootProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const uniqueId = useId();
  const triggerId = `dropdown-trigger-${uniqueId}`;
  const contentId = `dropdown-content-${uniqueId}`;

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        contentId,
        triggerId,
      }}
    >
      <Popper.Root>{children}</Popper.Root>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenu = DropdownMenuRoot;
