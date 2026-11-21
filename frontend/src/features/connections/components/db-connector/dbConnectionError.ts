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
