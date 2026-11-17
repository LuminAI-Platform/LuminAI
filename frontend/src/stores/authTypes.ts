// ─── Auth Store — shared types & token utilities ─────────────────────────────
import type { User } from "oidc-client-ts";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  loginMock: (email: string, name: string, roles?: string[]) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthSession: () => void;
  handleCallback: () => Promise<User | null>;
  checkUser: () => Promise<User | null>;
  refreshToken: () => Promise<string | null>;
  ensureFreshToken: () => Promise<string | null>;
  clearError: () => void;
}

export const AUTH_URL =
  (import.meta.env.VITE_AUTH_URL as string | undefined) ??
  "http://localhost:8180/realms/luminai";

export const CLIENT_ID =
  (import.meta.env.VITE_AUTH_CLIENT_ID as string | undefined) ?? "luminai-spa";

export const OIDC_SESSION_KEY = `oidc.user:${AUTH_URL}:${CLIENT_ID}`;

// ─── Token persistence helpers ────────────────────────────────────────────────

export function persistTokens(user: User | null): void {
  if (typeof localStorage === "undefined" || !user) return;
  if (user.access_token) {
    localStorage.setItem("lumin_access_token", user.access_token);
    localStorage.setItem("token", user.access_token);
  }
  if (user.profile) {
    localStorage.setItem("lumin_user", JSON.stringify(user.profile));
  }
}

export function clearPersistedTokens(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("lumin_access_token");
  localStorage.removeItem("lumin_user");
  localStorage.removeItem("token");
  localStorage.removeItem("local_ingested_files");
  localStorage.removeItem("most_recent_ingested_file");
  localStorage.removeItem("lumin_schema_mapping");
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function hasRealmRole(user: User | null, role: string): boolean {
  if (!user) return false;

  let realmAccess = user.profile?.realm_access;

  // Keycloak places realm_access in the access_token, not id_token.
  // If missing from profile, decode the access_token payload.
  if (!realmAccess && user.access_token) {
    try {
      const payloadBase64Url = user.access_token.split(".")[1];
      if (payloadBase64Url) {
        const payloadBase64 = payloadBase64Url
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          window
            .atob(payloadBase64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        );
        const decoded = JSON.parse(jsonPayload);
        realmAccess = decoded.realm_access;
      }
    } catch (e) {
      console.error("Failed to decode access token", e);
    }
  }

  if (!realmAccess || typeof realmAccess !== "object") return false;
  const roles = (realmAccess as { roles?: unknown }).roles;
  return Array.isArray(roles) && roles.includes(role);
}

export function isPlatformAdmin(user: User | null): boolean {
  return hasRealmRole(user, "PLATFORM_ADMIN");
}
