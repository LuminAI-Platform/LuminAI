/**
 * Display-only privacy masking utilities for sensitive entity fields.
 *
 * Rules are strictly based on field name and formatting:
 * - Email: b***@corp.com
 * - Date of birth: 19**-**-**
 * - Phone, salary, national/insurance/medical IDs: ••••••
 */

export type SensitiveFieldKind = "email" | "dob" | "phone" | "salary" | "id";

const EMAIL_PATTERNS = [
  /^e[-_ ]?mail$/i,
  /email[-_ ]?addr/i,
  /contact[-_ ]?email/i,
  /work[-_ ]?email/i,
  /personal[-_ ]?email/i,
  /_email$/i,
];

const DOB_PATTERNS = [
  /^dob$/i,
  /date[-_ ]?of[-_ ]?birth/i,
  /birth[-_ ]?date/i,
  /birthdate/i,
  /birthday/i,
];

const PHONE_PATTERNS = [
  /phone/i,
  /mobile/i,
  /telephone/i,
  /^tel$/i,
  /cell[-_ ]?(num|number|phone)?$/i,
  /^fax$/i,
];

const SALARY_PATTERNS = [
  /salary/i,
  /income/i,
  /compensation/i,
  /\bwage\b/i,
  /annual[-_ ]?pay/i,
  /base[-_ ]?pay/i,
  /net[-_ ]?worth/i,
];

const ID_PATTERNS = [
  /\bssn\b/i,
  /social[-_ ]?security/i,
  /\bsin\b/i,
  /\bnin\b/i,
  /national[-_ ]?id/i,
  /tax[-_ ]?id/i,
  /\btin\b/i,
  /passport/i,
  /driver[-_ ]?license/i,
  /license[-_ ]?(num|number|id)/i,
  /insurance[-_ ]?(id|num|number|policy)/i,
  /policy[-_ ]?(num|number|id)/i,
  /member[-_ ]?id/i,
  /\bmrn\b/i,
  /medical[-_ ]?record/i,
  /health[-_ ]?(id|card|number)/i,
  /credit[-_ ]?card/i,
  /card[-_ ]?number/i,
  /\biban\b/i,
  /bank[-_ ]?account/i,
  /routing[-_ ]?number/i,
];

/**
 * Classifies a field name into a sensitive category, or returns null if non-sensitive.
 */
export function getSensitiveFieldKind(
  fieldName: string,
): SensitiveFieldKind | null {
  const normalized = fieldName.trim();
  if (!normalized) return null;

  if (EMAIL_PATTERNS.some((re) => re.test(normalized))) return "email";
  if (DOB_PATTERNS.some((re) => re.test(normalized))) return "dob";
  if (PHONE_PATTERNS.some((re) => re.test(normalized))) return "phone";
  if (SALARY_PATTERNS.some((re) => re.test(normalized))) return "salary";
  if (ID_PATTERNS.some((re) => re.test(normalized))) return "id";

  return null;
}

/**
 * Returns true if the given property name should be masked when privacy mode is enabled.
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
 * field name matches a sensitive category.
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
