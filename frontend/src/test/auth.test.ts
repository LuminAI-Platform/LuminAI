import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useAuthStore,
  hasRealmRole,
  isPlatformAdmin,
} from "../stores/authStore";
import type { User } from "oidc-client-ts";
import { queryClient } from "../lib/queryClient";
import { getAccessToken } from "../lib/api";

describe("Authentication & Authorization Security", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().clearAuthSession();
  });

  describe("Role Verification (hasRealmRole / isPlatformAdmin)", () => {
    it("should return false for null user", () => {
      expect(hasRealmRole(null, "PLATFORM_ADMIN")).toBe(false);
      expect(isPlatformAdmin(null)).toBe(false);
    });

    it("should recognize roles defined in profile.realm_access", () => {
      const mockUser = {
        profile: {
          realm_access: {
            roles: ["PLATFORM_ADMIN", "ANALYST"],
          },
        },
      } as unknown as User;

      expect(hasRealmRole(mockUser, "PLATFORM_ADMIN")).toBe(true);
      expect(hasRealmRole(mockUser, "ANALYST")).toBe(true);
      expect(hasRealmRole(mockUser, "UNKNOWN_ROLE")).toBe(false);
      expect(isPlatformAdmin(mockUser)).toBe(true);
    });

    it("should decode JWT access_token to extract realm_access when omitted from profile", () => {
      // Create a JWT with base64 payload
      const payload = {
        sub: "user-123",
        realm_access: {
          roles: ["PLATFORM_ADMIN", "OPERATOR"],
        },
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const mockUser = {
        profile: {},
        access_token: mockToken,
      } as unknown as User;

      expect(hasRealmRole(mockUser, "PLATFORM_ADMIN")).toBe(true);
      expect(hasRealmRole(mockUser, "OPERATOR")).toBe(true);
      expect(hasRealmRole(mockUser, "AUDITOR")).toBe(false);
    });
  });

  describe("Session Management & Tenant Partitioning", () => {
    it("should clear session, remove un-namespaced keys, and purge query cache on clearAuthSession", () => {
      // Simulate tenant artifacts in local storage
      localStorage.setItem(
        "local_ingested_files",
        JSON.stringify([{ id: "test" }]),
      );
      localStorage.setItem("most_recent_ingested_file", "test.csv");
      localStorage.setItem("lumin_schema_mapping", "{}");
      sessionStorage.setItem("post_login_redirect", "/explorer/entity/123");

      const queryClientClearSpy = vi.spyOn(queryClient, "clear");

      useAuthStore.getState().clearAuthSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem("lumin_access_token")).toBeNull();
      expect(localStorage.getItem("lumin_user")).toBeNull();
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("local_ingested_files")).toBeNull();
      expect(localStorage.getItem("most_recent_ingested_file")).toBeNull();
      expect(localStorage.getItem("lumin_schema_mapping")).toBeNull();
      expect(sessionStorage.getItem("post_login_redirect")).toBeNull();
      expect(queryClientClearSpy).toHaveBeenCalled();
    });

    it("should persist lumin_access_token and lumin_user in localStorage on loginMock", async () => {
      await useAuthStore
        .getState()
        .loginMock("alice@acme.com", "Alice Acme", ["admin", "PLATFORM_ADMIN"]);

      const storedToken = localStorage.getItem("lumin_access_token");
      const storedUser = localStorage.getItem("lumin_user");
      const legacyToken = localStorage.getItem("token");

      expect(storedToken).toBe("mock-access-token-123");
      expect(legacyToken).toBe("mock-access-token-123");
      expect(storedUser).not.toBeNull();
      const parsedUser = JSON.parse(storedUser!);
      expect(parsedUser.email).toBe("alice@acme.com");
      expect(parsedUser.name).toBe("Alice Acme");
      expect(getAccessToken()).toBe("mock-access-token-123");
    });

    it("should resolve access token via getAccessToken from localStorage if store is empty", () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      localStorage.setItem("lumin_access_token", "test-local-token-xyz");

      expect(getAccessToken()).toBe("test-local-token-xyz");
    });
  });
});
