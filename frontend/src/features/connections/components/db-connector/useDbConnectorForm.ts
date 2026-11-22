import { useState, useMemo, useCallback } from "react";
import type { DBType } from "./dbConnectorTypes";
import {
  DEFAULT_DB_PORTS,
  type DbFormField,
  validateDbForm,
  isDbFormValid,
} from "./dbConnectorUtils";
import { useDbConnectorDiscovery } from "./useDbConnectorDiscovery";

interface UseDbConnectorFormOptions {
  initialDbType?: DBType;
  onSuccess: () => void;
  onClose: () => void;
}

export function useDbConnectorForm({
  initialDbType = "postgresql",
  onSuccess,
  onClose,
}: UseDbConnectorFormOptions) {
  const [name, setName] = useState("");
  const [dbType, setDbType] = useState<DBType>(initialDbType);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(
    String(DEFAULT_DB_PORTS[initialDbType] ?? 5432),
  );
  const [portManuallyEdited, setPortManuallyEdited] = useState(false);
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Partial<Record<DbFormField, boolean>>>(
    {},
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const formValues = useMemo(
    () => ({ name, dbType, host, port, databaseName, username, password }),
    [name, dbType, host, port, databaseName, username, password],
  );

  const errors = useMemo(() => validateDbForm(formValues), [formValues]);
  const formValid = useMemo(() => isDbFormValid(formValues), [formValues]);

  const markAllTouched = useCallback(() => {
    setTouched({
      name: true,
      host: true,
      port: true,
      databaseName: true,
      username: true,
      password: true,
    });
  }, []);

  const clearPassword = useCallback(() => setPassword(""), []);

  const discovery = useDbConnectorDiscovery({
    name,
    dbType,
    host,
    port,
    databaseName,
    username,
    password,
    formValid,
    markAllTouched,
    onSuccess,
    clearPassword,
  });

  const isBusy = discovery.isTesting || discovery.isDiscovering;

  const hasUnsavedChanges = Boolean(
    name.trim() ||
    host.trim() ||
    databaseName.trim() ||
    username.trim() ||
    password.length > 0 ||
    discovery.isConnected,
  );

  const clearSecretsAndClose = () => {
    discovery.abortRef.current?.abort();
    setPassword("");
    onClose();
  };

  const requestClose = () => {
    if (discovery.isSaving) return;
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      clearSecretsAndClose();
    }
  };

  const handleDbTypeChange = (nextType: DBType) => {
    setDbType(nextType);
    if (!portManuallyEdited) {
      setPort(String(DEFAULT_DB_PORTS[nextType] ?? 5432));
    }
    discovery.setTestResult(null);
    discovery.setConnectionError(null);
  };

  const handlePortChange = (val: string) => {
    setPort(val);
    setPortManuallyEdited(true);
    discovery.setTestResult(null);
    discovery.setConnectionError(null);
  };

  const handleBlurField = (field: DbFormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleApplyConnectionString = (parsed: {
    dbType?: DBType;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
  }) => {
    if (parsed.dbType) setDbType(parsed.dbType);
    if (parsed.host) setHost(parsed.host);
    if (parsed.port) {
      setPort(String(parsed.port));
      setPortManuallyEdited(true);
    }
    if (parsed.databaseName) setDatabaseName(parsed.databaseName);
    if (parsed.username) setUsername(parsed.username);
    if (parsed.password !== undefined) setPassword(parsed.password);
    discovery.setTestResult(null);
    discovery.setConnectionError(null);
  };

  return {
    name,
    setName,
    dbType,
    host,
    setHost,
    port,
    databaseName,
    setDatabaseName,
    username,
    setUsername,
    password,
    setPassword,
    touched,
    ...discovery,
    showDiscardConfirm,
    setShowDiscardConfirm,
    errors,
    formValid,
    isBusy,
    hasUnsavedChanges,
    clearSecretsAndClose,
    requestClose,
    handleDbTypeChange,
    handlePortChange,
    handleBlurField,
    handleApplyConnectionString,
  };
}
