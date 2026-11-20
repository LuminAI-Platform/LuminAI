import type { DBType } from "./dbConnectorTypes";

export const DEFAULT_DB_PORTS: Record<DBType, number> = {
  postgresql: 5432,
  mysql: 3306,
  snowflake: 443,
  sqlserver: 1433,
};

export interface DbFormValues {
  name: string;
  dbType: DBType;
  host: string;
  port: string;
  databaseName: string;
  username: string;
  password: string;
}

export type DbFormField = keyof DbFormValues;

export type DbFormErrors = Partial<Record<DbFormField, string>>;

const HOST_REGEX =
  /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export function validateDbField(
  field: DbFormField,
  value: string,
): string | undefined {
  const trimmed = value.trim();

  switch (field) {
    case "name":
      if (!trimmed) return "Connector name is required.";
      if (trimmed.length < 2) return "Enter at least 2 characters.";
      return undefined;
    case "host":
      if (!trimmed) return "Host is required.";
      if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) {
        return "Enter a hostname or IP without a protocol prefix.";
      }
      if (!HOST_REGEX.test(trimmed)) {
        return "Enter a valid hostname or IPv4 address.";
      }
      return undefined;
    case "port": {
      if (!trimmed) return "Port is required.";
      const num = Number(trimmed);
      if (!Number.isInteger(num) || num < 1 || num > 65535) {
        return "Port must be an integer between 1 and 65535.";
      }
      return undefined;
    }
    case "databaseName":
      if (!trimmed) return "Database name is required.";
      return undefined;
    case "username":
      if (!trimmed) return "Username is required.";
      return undefined;
    case "password":
      if (!value) return "Password is required.";
      return undefined;
    default:
      return undefined;
  }
}

export function validateDbForm(values: DbFormValues): DbFormErrors {
  const fields: DbFormField[] = [
    "name",
    "host",
    "port",
    "databaseName",
    "username",
    "password",
  ];
  const errors: DbFormErrors = {};
  for (const field of fields) {
    const err = validateDbField(field, values[field]);
    if (err) errors[field] = err;
  }
  return errors;
}

export function isDbFormValid(values: DbFormValues): boolean {
  return Object.keys(validateDbForm(values)).length === 0;
}

export interface ParsedConnectionString {
  dbType?: DBType;
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  password?: string;
}

/**
 * Client-side only connection string parser. Never sends the raw string
 * over the network or logs it.
 */
export function parseConnectionString(
  raw: string,
): ParsedConnectionString | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Normalize JDBC prefix if pasted (e.g. jdbc:postgresql://...)
  const normalized = trimmed.replace(/^jdbc:/i, "");

  try {
    const url = new URL(normalized);
    const protocol = url.protocol.replace(":", "").toLowerCase();

    let dbType: DBType | undefined;
    if (protocol === "postgres" || protocol === "postgresql") {
      dbType = "postgresql";
    } else if (protocol === "mysql" || protocol === "mariadb") {
      dbType = "mysql";
    } else if (protocol === "mssql" || protocol === "sqlserver") {
      dbType = "sqlserver";
    } else if (protocol === "snowflake") {
      dbType = "snowflake";
    }

    const host = url.hostname || undefined;
    const portNum = url.port ? Number(url.port) : undefined;
    const validPort =
      portNum && Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535
        ? portNum
        : dbType
          ? DEFAULT_DB_PORTS[dbType]
          : undefined;
    const databaseName = url.pathname.replace(/^\/+/, "") || undefined;
    const username = url.username
      ? decodeURIComponent(url.username)
      : undefined;
    const password = url.password
      ? decodeURIComponent(url.password)
      : undefined;

    if (!host && !databaseName && !username) return null;

    return {
      dbType,
      host,
      port: validPort,
      databaseName,
      username,
      password,
    };
  } catch {
    return null;
  }
}

export interface ClassifiedConnectionError {
  title: string;
  suggestion: string;
  technicalDetails: string;
}

/**
 * Classifies backend/JDBC error strings into clear, actionable user messages
 * without exposing raw stack traces in the primary alert.
 */
export function classifyConnectionError(
  rawMessage: string,
): ClassifiedConnectionError {
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("password") ||
    lower.includes("authentication failed") ||
    lower.includes("28p01") ||
    lower.includes("access denied") ||
    lower.includes("login failed") ||
    lower.includes("invalid credentials")
  ) {
    return {
      title: "Authentication failed",
      suggestion:
        "Check the username and password, and verify the account has login privileges.",
      technicalDetails: rawMessage,
    };
  }

  if (
    lower.includes("unknownhost") ||
    lower.includes("unknown host") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("host unreachable") ||
    lower.includes("no route to host")
  ) {
    return {
      title: "Host unreachable",
      suggestion:
        "Check the hostname spelling and verify the database is reachable from this network.",
      technicalDetails: rawMessage,
    };
  }

  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("etimedout")
  ) {
    return {
      title: "Connection timed out",
      suggestion:
        "Verify firewall rules, VPC/security groups, and that the target port is open.",
      technicalDetails: rawMessage,
    };
  }

  if (
    lower.includes("connection refused") ||
    lower.includes("econnrefused") ||
    lower.includes("refused")
  ) {
    return {
      title: "Connection refused",
      suggestion:
        "Confirm the database server is running and listening on the specified port.",
      technicalDetails: rawMessage,
    };
  }

  if (
    lower.includes("does not exist") ||
    lower.includes("unknown database") ||
    lower.includes("3d000") ||
    lower.includes("database not found")
  ) {
    return {
      title: "Database not found",
      suggestion:
        "Verify the exact database name (including capitalization) and try again.",
      technicalDetails: rawMessage,
    };
  }

  return {
    title: "Could not connect to database",
    suggestion:
      "Double-check the host, port, database name, and credentials, then try again.",
    technicalDetails: rawMessage,
  };
}
