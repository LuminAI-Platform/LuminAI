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
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.PROD
    ? "https://luminai-api.onrender.com"
    : "http://localhost:8080");

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

  let response: Response;
  try {
    response = await fetch(url, { ...resolvedInit, headers });
  } catch (err) {
    if (typeof url === "string") {
      if (url.includes("/api/v1/explorer/search")) {
        return getMockSearchResponse(url);
      }
      if (url.includes("/api/v1/explorer/entities/")) {
        return getMockEntityDetailResponse(url);
      }
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 404 && typeof url === "string") {
      if (url.includes("/api/v1/explorer/search")) {
        return getMockSearchResponse(url);
      }
      if (url.includes("/api/v1/explorer/entities/")) {
        return getMockEntityDetailResponse(url);
      }
    }
    throw new ApiError(response);
  }

  return response;
}

function getMockEntityDetailResponse(url: string): Response {
  const parts = url.split("/api/v1/explorer/entities/");
  const entityId = parts[1]?.split("?")[0] ?? "";
  const entity = getMockEntityById(entityId) ?? MOCK_ENTITIES[0];
  return new Response(JSON.stringify(entity), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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
 */
export function createApiConfig() {
  return {
    basePath: API_BASE_URL,
    fetchApi: apiFetch,
  } as const;
}

// ─── Mock Explorer Search Fallback Data & Handler ─────────────────────────────

export interface MockEntity {
  id: string;
  canonicalName: string;
  entityType: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

/**
 * Returns a single mock entity by ID for the EntityDetailPage fallback.
 * TODO: Remove when GET /api/v1/explorer/entities/:id is available on the backend.
 */
export function getMockEntityById(id: string): MockEntity | undefined {
  return MOCK_ENTITIES.find((e) => e.id === id);
}

const MOCK_ENTITIES: MockEntity[] = [
  {
    id: "e1",
    canonicalName: "Alice Smith",
    entityType: "Person",
    properties: {
      email: "alice.smith@luminai.com",
      role: "Software Engineer",
      status: "Active",
      department: "Engineering",
    },
    createdAt: "2026-08-15T10:00:00Z",
  },
  {
    id: "e2",
    canonicalName: "LuminAI Technologies",
    entityType: "Organization",
    properties: {
      domain: "luminai.com",
      industry: "Artificial Intelligence",
      location: "San Francisco, CA",
      employees: 120,
    },
    createdAt: "2026-08-12T09:00:00Z",
  },
  {
    id: "e3",
    canonicalName: "users_gold_v2",
    entityType: "Dataset",
    properties: {
      size: "14.2 MB",
      rows: 154000,
      type: "Table",
      format: "Parquet",
    },
    createdAt: "2026-08-19T23:40:00Z",
  },
  {
    id: "e4",
    canonicalName: "sales_raw_parquet",
    entityType: "Dataset",
    properties: {
      size: "1.4 GB",
      rows: 12050000,
      type: "S3 Folder",
      format: "Parquet",
    },
    createdAt: "2026-08-19T22:30:00Z",
  },
  {
    id: "e5",
    canonicalName: "stripe_transactions",
    entityType: "Dataset",
    properties: {
      size: "Real-time",
      rows: 92830,
      type: "API Stream",
      format: "JSON",
    },
    createdAt: "2026-08-19T23:00:00Z",
  },
  {
    id: "e6",
    canonicalName: "Bob Johnson",
    entityType: "Person",
    properties: {
      email: "bob.johnson@luminai.com",
      role: "Product Manager",
      status: "Active",
      department: "Product",
    },
    createdAt: "2026-08-14T11:00:00Z",
  },
  {
    id: "e7",
    canonicalName: "Charlie Brown",
    entityType: "Person",
    properties: {
      email: "charlie@luminai.com",
      role: "Security Architect",
      status: "Inactive",
      department: "Security",
    },
    createdAt: "2026-08-13T08:30:00Z",
  },
  {
    id: "e8",
    canonicalName: "Acme Corp",
    entityType: "Organization",
    properties: {
      domain: "acme.org",
      industry: "Manufacturing",
      location: "Chicago, IL",
      employees: 1250,
    },
    createdAt: "2026-08-11T14:00:00Z",
  },
  {
    id: "e9",
    canonicalName: "Prod Database Instance",
    entityType: "Device",
    properties: {
      ip: "10.0.4.15",
      host: "aws-prod-db-01",
      os: "Ubuntu Linux",
      status: "Online",
    },
    createdAt: "2026-08-01T04:20:00Z",
  },
  {
    id: "e10",
    canonicalName: "Developer Workstation",
    entityType: "Device",
    properties: {
      ip: "192.168.1.55",
      host: "workstation-mac-08",
      os: "macOS Sequoia",
      status: "Online",
    },
    createdAt: "2026-08-10T12:00:00Z",
  },
  {
    id: "e11",
    canonicalName: "San Francisco Office",
    entityType: "Location",
    properties: {
      address: "100 Pine St",
      city: "San Francisco",
      state: "CA",
      country: "USA",
    },
    createdAt: "2026-08-05T09:00:00Z",
  },
  {
    id: "e12",
    canonicalName: "London Office",
    entityType: "Location",
    properties: { address: "30 St Mary Axe", city: "London", country: "UK" },
    createdAt: "2026-08-06T10:00:00Z",
  },
];

function getMockSearchResponse(url: string): Response {
  // Parse query parameters
  const urlObj = new URL(
    url,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  const query = urlObj.searchParams.get("query") || "";
  const entityTypes = urlObj.searchParams.getAll("entityType");
  const page = parseInt(urlObj.searchParams.get("page") || "0", 10);
  const size = parseInt(urlObj.searchParams.get("size") || "10", 10);

  // Perform search filtering
  let filtered = MOCK_ENTITIES;
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter((item) => {
      if (item.canonicalName.toLowerCase().includes(q)) return true;
      if (item.entityType.toLowerCase().includes(q)) return true;
      return Object.values(item.properties).some((val) =>
        String(val).toLowerCase().includes(q),
      );
    });
  }

  // Calculate facets counts (group counts grouped by entityType before filtering by type)
  const facets: Record<string, number> = {};
  // Seed all known types with 0
  MOCK_ENTITIES.forEach((e) => {
    facets[e.entityType] = 0;
  });
  filtered.forEach((item) => {
    facets[item.entityType] = (facets[item.entityType] || 0) + 1;
  });

  // Filter by selected facet entityTypes
  if (entityTypes.length > 0 && !entityTypes.includes("")) {
    filtered = filtered.filter((item) => entityTypes.includes(item.entityType));
  }

  // Helper function to escape special characters for regex
  function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Generate highlights
  const content = filtered.map((item) => {
    const highlights: Record<string, string[]> = {};
    const q = query.toLowerCase().trim();
    if (q) {
      // Highlight canonicalName
      if (item.canonicalName.toLowerCase().includes(q)) {
        const idx = item.canonicalName.toLowerCase().indexOf(q);
        const originalText = item.canonicalName.substring(idx, idx + q.length);
        const highlighted = item.canonicalName.replace(
          new RegExp(escapeRegExp(originalText), "gi"),
          (match) => `<em>${match}</em>`,
        );
        highlights["canonicalName"] = [highlighted];
      }

      // Highlight property values
      Object.entries(item.properties).forEach(([key, val]) => {
        const valStr = String(val);
        if (valStr.toLowerCase().includes(q)) {
          const idx = valStr.toLowerCase().indexOf(q);
          const originalText = valStr.substring(idx, idx + q.length);
          const highlighted = valStr.replace(
            new RegExp(escapeRegExp(originalText), "gi"),
            (match) => `<em>${match}</em>`,
          );
          highlights[`properties.${key}`] = [highlighted];
        }
      });
    }

    return {
      ...item,
      highlights,
    };
  });

  // Pagination
  const totalElements = content.length;
  const totalPages = Math.ceil(totalElements / size);
  const start = page * size;
  const paginatedContent = content.slice(start, start + size);

  const mockData = {
    content: paginatedContent,
    facets: facets,
    totalElements,
    totalPages,
    size,
    number: page,
  };

  return new Response(JSON.stringify(mockData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
