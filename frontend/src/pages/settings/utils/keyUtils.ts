import { MASKED_KEY_PLACEHOLDER } from "../constants";
import type { ApiKeysResponse } from "../types";

/**
 * Derives formatted display key representation with secret masking.
 */
export function getDisplayedKey(
  rawKey: string,
  apiKeyData?: ApiKeysResponse,
): string {
  if (rawKey) return rawKey;
  if (apiKeyData?.hasKey && apiKeyData.key) {
    return `${apiKeyData.key.keyPrefix}${MASKED_KEY_PLACEHOLDER}`;
  }
  return "No active API key. Click 'Roll Key' to generate one.";
}

