import { createContext, useContext } from "react";

export interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentId: string;
  triggerId: string;
}

export const DropdownMenuContext =
  createContext<DropdownMenuContextValue | null>(null);

export const useDropdownMenu = () => {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error(
      "DropdownMenu subcomponents must be used within DropdownMenuRoot",
    );
  }
  return context;
};
