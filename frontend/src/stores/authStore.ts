import { create } from "zustand";
import type { User } from "oidc-client-ts";
import { userManager } from "../lib/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  loginMock: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  handleCallback: () => Promise<User | null>;
  checkUser: () => Promise<User | null>;
  clearError: () => void;
}

// oidc-client-ts v3 session storage key format:
// "oidc.user:<authority>:<client_id>"
const OIDC_SESSION_KEY =
  "oidc.user:http://localhost:8180/realms/luminai:luminai-spa";

// Module-level flag: prevents concurrent checkUser() calls (e.g. React StrictMode
// double-invokes effects, which would otherwise race two getUser() promises).
let checkUserInFlight = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false, // false on init; set to true only when checkUser() actually runs
  error: null,

  login: async () => {
    try {
      set({ isLoading: true, error: null });
      await userManager.signinRedirect();
      // Note: execution stops here — browser navigates away to Keycloak
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to initiate login flow";
      set({ error: errorMsg, isLoading: false });
      throw err;
    }
  },

  loginMock: async (email: string, name: string) => {
    try {
      set({ isLoading: true, error: null });

      // Build a mock user shape that satisfies oidc-client-ts v3 User construction.
      // We write it directly into sessionStorage so getUser() can find it on refresh.
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const mockUserData = {
        profile: {
          sub: "mock-sub-12345",
          iss: "http://localhost:8180/realms/luminai",
          aud: "luminai-spa",
          exp: expiresAt,
          iat: Math.floor(Date.now() / 1000),
          name: name,
          preferred_username: name.toLowerCase().replace(" ", "."),
          email: email,
          email_verified: true,
        },
        access_token: "mock-access-token-123",
        refresh_token: "mock-refresh-token-123",
        id_token: "mock-id-token-123",
        token_type: "Bearer",
        scope: "openid profile email",
        expires_at: expiresAt,
        session_state: null,
      };

      sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify(mockUserData));

      set({
        user: mockUserData as unknown as User,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Mock login failed";
      set({ error: errorMsg, isLoading: false });
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });

      const sessionData = sessionStorage.getItem(OIDC_SESSION_KEY);
      const isMock = sessionData?.includes("mock-access-token-123");

      // Clear store state and sessionStorage unconditionally
      set({ user: null, isAuthenticated: false });
      sessionStorage.removeItem(OIDC_SESSION_KEY);

      if (!isMock) {
        // signoutRedirect navigates browser away to Keycloak logout endpoint
        await userManager.signoutRedirect();
      }

      set({ isLoading: false });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to sign out";
      set({ error: errorMsg, isLoading: false });
    }
  },

  handleCallback: async () => {
    try {
      set({ isLoading: true, error: null });
      const user = await userManager.signinRedirectCallback();
      set({ user, isAuthenticated: !!user, isLoading: false });
      return user;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Callback handling failed";
      set({ error: errorMsg, isLoading: false });
      throw err;
    }
  },

  /**
   * Checks sessionStorage for an existing valid OIDC session.
   * Called by ProtectedRoute on every mount.
   *
   * FIX: previous version had an early-return bug — when the user was already
   * authenticated in memory, it returned immediately without calling
   * `set({ isLoading: false })`, leaving the loading spinner visible forever
   * after hot-reloads or component re-mounts.
   */
  checkUser: async (): Promise<User | null> => {
    const currentState = get();

    // Fast path: already authenticated with a live token — nothing to do.
    if (
      currentState.isAuthenticated &&
      currentState.user &&
      !currentState.user.expired
    ) {
      return currentState.user;
    }

    // Guard against concurrent calls (StrictMode double-invoke, multiple ProtectedRoute mounts).
    // The second caller waits until the first resolves, then re-reads from state.
    if (checkUserInFlight) {
      // Poll until the in-flight call finishes (isLoading flips back to false)
      await new Promise<void>((resolve) => {
        const unsub = useAuthStore.subscribe((s: AuthState) => {
          if (!s.isLoading) {
            unsub();
            resolve();
          }
        });
      });
      const s = get();
      return s.isAuthenticated && s.user && !s.user.expired ? s.user : null;
    }

    checkUserInFlight = true;
    try {
      set({ isLoading: true, error: null });
      const user = await userManager.getUser();
      const isValid = user ? !user.expired : false;
      set({
        user: isValid ? user : null,
        isAuthenticated: isValid,
        isLoading: false,
      });
      checkUserInFlight = false;
      return isValid ? user : null;
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to retrieve active session";
      set({
        error: errorMsg,
        isLoading: false,
        isAuthenticated: false,
        user: null,
      });
      checkUserInFlight = false;
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
