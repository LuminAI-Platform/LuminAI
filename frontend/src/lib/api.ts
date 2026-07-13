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

import { useAuthStore } from "../stores/authStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080";

// ─── Token resolver ───────────────────────────────────────────────────────────

/**
 * Reads the current JWT access token from the Zustand auth store.
 * Returns `null` when the user is not authenticated.
 */
function getAccessToken(): string | null {
  const { user } = useAuthStore.getState();
  return user?.access_token ?? null;
}

// ─── apiFetch ─────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `fetch` that:
 *  1. Prepends `API_BASE_URL` when a relative path is supplied.
 *  2. Injects `Authorization: Bearer <token>` from the auth store.
 *  3. Sets `Content-Type: application/json` unless the caller overrides it or
 *     the body is FormData.
 *  4. Throws an `ApiError` for non-2xx responses.
 *
 * Signature matches the `fetchApi` slot of the generated
 * `ConfigurationParameters` interface so it can be passed directly.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const resolvedInit: RequestInit = init ?? {};

  // Resolve full URL
  const url =
    typeof input === "string" && input.startsWith("/")
      ? `${API_BASE_URL}${input}`
      : input;

  // Build headers
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

  const response = await fetch(url, { ...resolvedInit, headers });

  if (!response.ok) {
    throw new ApiError(response);
  }

  return response;
}

// ─── ApiError ─────────────────────────────────────────────────────────────────

/**
 * Thrown when the server responds with a non-2xx status code.
 * Carries the original `Response` so callers can inspect status / body.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly response: Response;

  constructor(response: Response) {
    super(`API error: ${response.status} ${response.statusText}`);
    this.name = "ApiError";
    this.status = response.status;
    this.response = response;
  }

  /** Convenience: returns true when the request was rejected due to auth */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

// ─── createApiConfig ──────────────────────────────────────────────────────────

/**
 * Returns a `ConfigurationParameters`-compatible object for the generated
 * OpenAPI typescript-fetch client. Pass this to `new Configuration(...)`.
 *
 * The generated `Configuration` class accepts:
 *   basePath   — overrides the server URL from the spec
 *   fetchApi   — replaces the global `fetch` used by every API call
 *   headers    — merged into every request as default headers
 *   middleware — array of pre/post middleware hooks (optional)
 *
 * Example:
 *   import { createApiConfig } from '@/lib/api';
 *   import { Configuration, WorkflowsApi } from '@/lib/api-client';
 *
 *   const workflowsApi = new WorkflowsApi(new Configuration(createApiConfig()));
 */
export function createApiConfig() {
  return {
    basePath: API_BASE_URL,
    // apiFetch signature aligns with the generated fetchApi slot:
    //   (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    fetchApi: apiFetch,
  } as const;
}
