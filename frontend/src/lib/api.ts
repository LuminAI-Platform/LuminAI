/**
 * api.ts — Global fetch wrapper for LuminAI
 *
 * Injects the Keycloak JWT from the Zustand auth store into every request.
 * Used directly for ad-hoc calls, and also passed to the OpenAPI generated
 * client via `createApiConfig()`.
 *
 * Usage (ad-hoc):
 *   import { apiFetch } from '@/lib/api';
 *   const data = await apiFetch('/api/projects').then(r => r.json());
 *
 * Usage (generated client):
 *   import { createApiConfig } from '@/lib/api';
 *   import { ProjectsApi } from '@/lib/api-client';
 *   const api = new ProjectsApi(new Configuration(createApiConfig()));
 *   const projects = await api.listProjects();
 */

import { showToastNotification } from "../components/ui/ToastProvider";
import { ApiError, ApiTimeoutError } from "./apiErrors";
import { getAccessToken, handleUnauthorizedResponse } from "./apiAuth";

export { ApiError, ApiTimeoutError, getAccessToken };

// ─── Constants ────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.PROD
    ? typeof window !== "undefined"
      ? window.location.origin
      : ""
    : "http://localhost:8080");

/** Default request timeout in milliseconds (9 seconds, within the 8-10s specification) */
export const DEFAULT_REQUEST_TIMEOUT_MS = 9000;

/** Default timeout for multipart / large file uploads (15 minutes = 900,000 ms) */
export const UPLOAD_REQUEST_TIMEOUT_MS = 900_000;

// ─── apiFetch ─────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `fetch` that:
 *  1. Prepends `API_BASE_URL` when a relative path is supplied.
 *  2. Injects `Authorization: Bearer <token>` from the auth store.
 *  3. Sets `Content-Type: application/json` unless the caller overrides it or
 *     the body is FormData.
 *  4. Intercepts 401 responses to invalidate stale auth state and emit toast.
 *  5. Automatically surfaces server / client errors as non-blocking toasts.
 *  6. Throws an `ApiError` for non-2xx responses.
 */
export interface ApiRequestInit extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: ApiRequestInit,
): Promise<Response> {
  const resolvedInit: ApiRequestInit = init ?? {};

  const url =
    typeof input === "string" && input.startsWith("/")
      ? `${API_BASE_URL}${input}`
      : input;

  const headers = new Headers(resolvedInit.headers);

  if (
    !headers.has("Content-Type") &&
    !(resolvedInit.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const explicitTimeout = (resolvedInit as { timeoutMs?: number }).timeoutMs;
  const isMultipartUpload = resolvedInit.body instanceof FormData;
  // Multipart file uploads default to 15 minutes to comfortably accommodate 100MB+ files.
  // Standard API requests retain the 9-second responsive SLA. Setting timeoutMs: 0 disables timeouts.
  const timeoutMs =
    explicitTimeout !== undefined
      ? explicitTimeout
      : isMultipartUpload
        ? UPLOAD_REQUEST_TIMEOUT_MS
        : DEFAULT_REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  let isTimedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      isTimedOut = true;
      controller.abort(new ApiTimeoutError(timeoutMs, String(url)));
    }, timeoutMs);
  }

  const externalSignal = resolvedInit.signal;
  const onExternalAbort = () => {
    if (timeoutId) clearTimeout(timeoutId);
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...resolvedInit,
      headers,
      signal: controller.signal,
    });
  } catch (fetchErr: unknown) {
    if (isTimedOut) {
      const suppressToast = headers.get("X-Suppress-Toast") === "true";
      if (!suppressToast) {
        showToastNotification(
          "error",
          "Service Timeout",
          `Data engine request timed out (${Math.round(timeoutMs / 1000)}s).`,
        );
      }
      throw new ApiTimeoutError(timeoutMs, String(url));
    }
    throw fetchErr;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  if (!response.ok) {
    const isRetry = Boolean((resolvedInit as { _isRetry?: boolean })._isRetry);

    if (response.status === 401 && !isRetry) {
      const retryResponse = await handleUnauthorizedResponse(url, resolvedInit);
      if (retryResponse) {
        return retryResponse;
      }
    }

    const suppressToast = headers.get("X-Suppress-Toast") === "true";

    if (!suppressToast) {
      if (response.status >= 500) {
        showToastNotification(
          "error",
          "Server Error",
          `Server returned error (${response.status}). Please try again later.`,
        );
      } else if (response.status !== 401 && response.status !== 404) {
        showToastNotification(
          "error",
          "Request Failed",
          `HTTP ${response.status}: ${response.statusText || "Unable to complete request"}`,
        );
      }
    }
    throw new ApiError(response);
  }

  return response;
}

// ─── createApiConfig ──────────────────────────────────────────────────────────

/**
 * Returns a `ConfigurationParameters`-compatible object for the generated
 * OpenAPI typescript-fetch client. Pass this to `new Configuration(...)`.
 */
export function createApiConfig() {
  return {
    basePath: API_BASE_URL,
    fetchApi: apiFetch,
  } as const;
}
