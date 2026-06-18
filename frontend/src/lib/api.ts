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
 *   const api = new ProjectsApi(createApiConfig());
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
 *  3. Sets `Content-Type: application/json` unless the caller overrides it.
 *  4. Throws an `ApiError` for non-2xx responses.
 */
export async function apiFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  // Resolve full URL
  const url =
    typeof input === "string" && input.startsWith("/")
      ? `${API_BASE_URL}${input}`
      : input;

  // Build headers
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });

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
 * Returns a `Configuration` object compatible with the generated OpenAPI
 * typescript-fetch client.  Pass this to every generated `*Api` constructor.
 *
 * Example:
 *   import { createApiConfig } from '@/lib/api';
 *   import { WorkflowsApi } from '@/lib/api-client';
 *
 *   const workflowsApi = new WorkflowsApi(createApiConfig());
 */
export function createApiConfig() {
  return {
    basePath: API_BASE_URL,
    fetchApi: apiFetch as typeof fetch,
    headers: {
      "Content-Type": "application/json",
    },
  };
}
