/**
 * Display-only privacy masking utilities for sensitive entity fields.
 *
 * All sensitive field detection is driven by a single configurable constant:
 * `SENSITIVE_FIELD_KEYWORDS`. Ordinary fields such as Age or Gender are never
 * masked unless they match this list.
 */

export const SENSITIVE_FIELD_KEYWORDS = [
  "email",
  "phone",
  "dob",
  "birth",
  "national_id",
  "ssn",
  "insurance",
  "salary",
  "address",
  "diagnosis",
  "patient",
  "medical",
  "health",
] as const;

export type SensitiveFieldKeyword = (typeof SENSITIVE_FIELD_KEYWORDS)[number];

export type SensitiveFieldKind =
  | "email"
  | "dob"
  | "phone"
  | "salary"
  | "id"
  | "address"
  | "medical";

function normalizeFieldKey(fieldName: string): string {
  return fieldName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function matchesKeyword(normalizedKey: string, keyword: string): boolean {
  if (!normalizedKey) return false;
  if (normalizedKey === keyword) return true;
  if (keyword === "dob" || keyword === "ssn") {
    // Match as a standalone token (e.g. `dob`, `patient_dob`, `user_ssn`) to avoid false positives
    const tokens = normalizedKey.split("_");
    return tokens.includes(keyword);
  }
  return normalizedKey.includes(keyword);
}

/**
 * Classifies a field name into a sensitive category using `SENSITIVE_FIELD_KEYWORDS`,
 * or returns null if the field is not sensitive.
 */
export function getSensitiveFieldKind(
  fieldName: string,
): SensitiveFieldKind | null {
  const normalized = normalizeFieldKey(fieldName);
  if (!normalized) return null;

  const matched = SENSITIVE_FIELD_KEYWORDS.find((kw) =>
    matchesKeyword(normalized, kw),
  );
  if (!matched) return null;

  switch (matched) {
    case "email":
      return "email";
    case "dob":
    case "birth":
      return "dob";
    case "phone":
      return "phone";
    case "salary":
      return "salary";
    case "address":
      return "address";
    case "national_id":
    case "ssn":
    case "insurance":
      return "id";
    case "diagnosis":
    case "patient":
    case "medical":
    case "health":
      return "medical";
  }
}

/**
 * Returns true if the given property name should be masked when sensitive data is hidden.
 */
export function isSensitiveField(fieldName: string): boolean {
  return getSensitiveFieldKind(fieldName) !== null;
}

/**
 * Masks an email address as `b***@corp.com`.
 */
function maskEmail(raw: string): string {
  const trimmed = raw.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return "••••••";
  }
  const firstChar = trimmed[0];
  const domain = trimmed.slice(atIndex + 1);
  return `${firstChar}***@${domain}`;
}

/**
 * Masks a date of birth as `19**-**-**` (preserving century if a 4-digit year is detected).
 */
function maskDob(raw: string): string {
  const trimmed = raw.trim();
  const yearMatch = trimmed.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return `${yearMatch[1]}**-**-**`;
  }
  return "****-**-**";
}

/**
 * Formats a property value with display-only masking when `masked` is true and the
 * field name matches `SENSITIVE_FIELD_KEYWORDS`.
 */
export function maskSensitiveValue(
  fieldName: string,
  value: unknown,
  masked = true,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const str = typeof value === "object" ? JSON.stringify(value) : String(value);

  if (!masked) {
    return str;
  }

  const kind = getSensitiveFieldKind(fieldName);
  if (!kind) {
    return str;
  }

  switch (kind) {
    case "email":
      return maskEmail(str);
    case "dob":
      return maskDob(str);
    case "phone":
    case "salary":
    case "id":
    case "address":
    case "medical":
      return "••••••";
  }
}

/**
 * Checks whether an entity's property map contains any non-empty sensitive fields.
 */
export function hasSensitiveProperties(
  properties: Record<string, unknown>,
): boolean {
  return Object.entries(properties).some(
    ([key, val]) =>
      val !== null &&
      val !== undefined &&
      String(val).trim() !== "" &&
      isSensitiveField(key),
  );
}
