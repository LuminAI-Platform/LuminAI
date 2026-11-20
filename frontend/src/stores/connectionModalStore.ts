import { create } from "zustand";
import type { DBType } from "../features/connections/components/db-connector/dbConnectorTypes";

export type ConnectionModalAction = "new-db" | "upload" | null;

interface ConnectionModalState {
  chooserOpen: boolean;
  pendingAction: ConnectionModalAction;
  preselectedDbType: DBType | null;
  openChooser: () => void;
  closeChooser: () => void;
  requestAction: (
    action: ConnectionModalAction,
    dbType?: DBType | null,
  ) => void;
  consumePendingAction: () => {
    action: ConnectionModalAction;
    dbType: DBType | null;
  };
}

export const useConnectionModalStore = create<ConnectionModalState>(
  (set, get) => ({
    chooserOpen: false,
    pendingAction: null,
    preselectedDbType: null,

    openChooser: () => set({ chooserOpen: true }),
    closeChooser: () => set({ chooserOpen: false }),

    requestAction: (action, dbType = null) =>
      set({
        chooserOpen: false,
        pendingAction: action,
        preselectedDbType: dbType,
      }),

    consumePendingAction: () => {
      const { pendingAction, preselectedDbType } = get();
      if (pendingAction !== null || preselectedDbType !== null) {
        set({ pendingAction: null, preselectedDbType: null });
      }
      return { action: pendingAction, dbType: preselectedDbType };
    },
  }),
);
