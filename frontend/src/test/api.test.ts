import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiFetch, getAccessToken, ApiError } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { User } from "oidc-client-ts";

describe("apiFetch & Network Layer Robustness", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should return null access token when unauthenticated", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("should inject Bearer token into outgoing requests when user is authenticated", async () => {
    useAuthStore.setState({
      user: { access_token: "mock-jwt-token-12345" } as unknown as User,
      isAuthenticated: true,
    });

    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    const res = await apiFetch("/api/v1/test");
    expect(res.ok).toBe(true);
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer mock-jwt-token-12345");
    expect(capturedHeaders?.get("Content-Type")).toBe("application/json");
  });

  it("should throw ApiError with status and response on non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(apiFetch("/api/v1/missing")).rejects.toThrow(ApiError);
  });

  it("should trigger session clearing when backend responds with 401 Unauthorized", async () => {
    useAuthStore.setState({
      user: { access_token: "expired-token" } as unknown as User,
      isAuthenticated: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    try {
      await apiFetch("/api/v1/protected-data");
    } catch {
      // Expected rejection
    }

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
