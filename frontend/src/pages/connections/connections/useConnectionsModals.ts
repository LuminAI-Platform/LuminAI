import { useState, useCallback, useEffect } from "react";
import type { DBType } from "../../../features/connections/components/db-connector/dbConnectorTypes";
import { useConnectionModalStore } from "../../../stores/connectionModalStore";

export function useConnectionsModals() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [initialUploadFile, setInitialUploadFile] = useState<File | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [initialDbType, setInitialDbType] = useState<DBType>("postgresql");

  const pendingAction = useConnectionModalStore((s) => s.pendingAction);
  const consumePendingAction = useConnectionModalStore(
    (s) => s.consumePendingAction,
  );

  useEffect(() => {
    if (!pendingAction) return;
    const { action, dbType } = consumePendingAction();
    if (action === "new-db") {
      setInitialDbType(dbType ?? "postgresql");
      setIsDbModalOpen(true);
    } else if (action === "upload") {
      setInitialUploadFile(null);
      setIsWizardOpen(true);
    }
  }, [pendingAction, consumePendingAction]);

  const openDbModalWithType = useCallback((dbType: DBType = "postgresql") => {
    setInitialDbType(dbType);
    setIsDbModalOpen(true);
  }, []);

  const openWizardWithFile = useCallback((file?: File | null) => {
    setInitialUploadFile(file ?? null);
    setIsWizardOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setIsWizardOpen(false);
    setInitialUploadFile(null);
  }, []);

  return {
    isWizardOpen,
    setIsWizardOpen,
    initialUploadFile,
    isDbModalOpen,
    setIsDbModalOpen,
    initialDbType,
    openDbModalWithType,
    openWizardWithFile,
    closeWizard,
  };
}
