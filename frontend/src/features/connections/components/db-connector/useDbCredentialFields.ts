import { useState, useMemo } from "react";
import type { DBType } from "./dbConnectorTypes";
import {
  DEFAULT_DB_PORTS,
  type DbFormField,
  type ParsedConnectionString,
  validateDbForm,
  isDbFormValid,
} from "./dbConnectorUtils";

export function useDbCredentialFields(
  initialDbType: DBType,
  onResetStatus: () => void,
  onResetTestOnly: () => void,
) {
  const [name, setNameState] = useState("");
  const [dbType, setDbType] = useState<DBType>(initialDbType);
  const [host, setHostState] = useState("");
  const [port, setPortState] = useState(
    String(DEFAULT_DB_PORTS[initialDbType] ?? 5432),
  );
  const [portManuallyEdited, setPortManuallyEdited] = useState(false);
  const [databaseName, setDatabaseNameState] = useState("");
  const [username, setUsernameState] = useState("");
  const [password, setPasswordState] = useState("");
  const [touched, setTouched] = useState<Partial<Record<DbFormField, boolean>>>(
    {},
  );

  const formValues = useMemo(
    () => ({ name, dbType, host, port, databaseName, username, password }),
    [name, dbType, host, port, databaseName, username, password],
  );

  const errors = useMemo(() => validateDbForm(formValues), [formValues]);
  const formValid = useMemo(() => isDbFormValid(formValues), [formValues]);

  const hasFieldInput = Boolean(
    name.trim() ||
    host.trim() ||
    databaseName.trim() ||
    username.trim() ||
    password.length > 0,
  );

  const handleDbTypeChange = (nextType: DBType) => {
    setDbType(nextType);
    if (!portManuallyEdited) {
      setPortState(String(DEFAULT_DB_PORTS[nextType] ?? 5432));
    }
    onResetStatus();
  };

  const handlePortChange = (val: string) => {
    setPortState(val);
    setPortManuallyEdited(true);
    onResetStatus();
  };

  const handleBlurField = (field: DbFormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const markAllTouched = () => {
    setTouched({
      name: true,
      host: true,
      port: true,
      databaseName: true,
      username: true,
      password: true,
    });
  };

  const handleApplyConnectionString = (parsed: ParsedConnectionString) => {
    if (parsed.dbType) setDbType(parsed.dbType);
    if (parsed.host) setHostState(parsed.host);
    if (parsed.port) {
      setPortState(String(parsed.port));
      setPortManuallyEdited(true);
    }
    if (parsed.databaseName) setDatabaseNameState(parsed.databaseName);
    if (parsed.username) setUsernameState(parsed.username);
    if (parsed.password !== undefined) setPasswordState(parsed.password);
    onResetStatus();
  };

  return {
    name,
    setName: (v: string) => {
      setNameState(v);
      onResetTestOnly();
    },
    dbType,
    host,
    setHost: (v: string) => {
      setHostState(v);
      onResetStatus();
    },
    port,
    handlePortChange,
    databaseName,
    setDatabaseName: (v: string) => {
      setDatabaseNameState(v);
      onResetStatus();
    },
    username,
    setUsername: (v: string) => {
      setUsernameState(v);
      onResetStatus();
    },
    password,
    setPassword: (v: string) => {
      setPasswordState(v);
      onResetStatus();
    },
    clearPassword: () => setPasswordState(""),
    touched,
    errors,
    formValid,
    hasFieldInput,
    handleDbTypeChange,
    handleBlurField,
    markAllTouched,
    handleApplyConnectionString,
  };
}
