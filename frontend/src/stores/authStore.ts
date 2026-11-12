import { create } from "zustand";
import type { User } from "oidc-client-ts";
import { userManager } from "../lib/auth";
import { queryClient } from "../lib/queryClient";
import {
  type AuthState,
  OIDC_SESSION_KEY,
  persistTokens,
  clearPersistedTokens,
} from "./authTypes";

export {
  persistTokens,
  clearPersistedTokens,
  hasRealmRole,
  isPlatformAdmin,
} from "./authTypes";

// Module-level flag: prevents concurrent checkUser() calls (React StrictMode
// double-invokes effects, which would otherwise race two getUser() promises).
let checkUserInFlight = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async () => {
    try {
      set({ isLoading: true, error: null });
      await userManager.signinRedirect();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to initiate login flow";
      set({ error: errorMsg, isLoading: false });
      throw err;
    }
  },

  loginMock: async (email: string, name: string, roles?: string[]) => {
    try {
      set({ isLoading: true, error: null });
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const mockUserData = {
        profile: {
          sub: "mock-sub-12345",
          iss: "http://localhost:8180/realms/luminai",
          aud: "luminai-spa",
          exp: expiresAt,
          iat: Math.floor(Date.now() / 1000),
          name,
          preferred_username: name.toLowerCase().replace(" ", "."),
          email,
          email_verified: true,
          realm_access: { roles: roles ?? ["admin", "user", "PLATFORM_ADMIN"] },
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
      persistTokens(mockUserData as unknown as User);
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
      const isMock = sessionData?.includes("mock-access-token-123") ?? false;
      set({ user: null, isAuthenticated: false });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(OIDC_SESSION_KEY);
        sessionStorage.removeItem("post_login_redirect");
      }
      clearPersistedTokens();
      queryClient.clear();
      if (!isMock) await userManager.signoutRedirect();
      set({ isLoading: false });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to sign out";
      set({ error: errorMsg, isLoading: false });
    }
  },

  clearAuthSession: () => {
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(OIDC_SESSION_KEY);
      sessionStorage.removeItem("post_login_redirect");
    }
    clearPersistedTokens();
    queryClient.clear();
  },

  handleCallback: async () => {
    try {
      set({ isLoading: true, error: null });
      const user = await userManager.signinRedirectCallback();
      if (user) persistTokens(user);
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
   */
  checkUser: async (): Promise<User | null> => {
    const currentState = get();
    if (
      currentState.isAuthenticated &&
      currentState.user &&
      !currentState.user.expired
    ) {
      return currentState.user;
    }

    if (checkUserInFlight) {
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
      if (isValid && user) persistTokens(user);
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

  refreshToken: async (): Promise<string | null> => {
    try {
      const user = await userManager.signinSilent();
      if (user && !user.expired) {
        persistTokens(user);
        set({ user, isAuthenticated: true, error: null });
        return user.access_token;
      }
      return null;
    } catch (err) {
      console.warn("Silent token refresh failed:", err);
      return null;
    }
  },

  ensureFreshToken: async (): Promise<string | null> => {
    const { user, refreshToken } = get();
    // Proactively refresh if token expires within 5 minutes (300s) or is already expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = user?.expires_at ?? 0;
    if (!user || expiresAt - now < 300) {
      console.info(
        "[Auth] Token expires soon or is expired. Proactively renewing...",
      );
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        return refreshedToken;
      }
    }
    return user?.access_token ?? null;
  },

  clearError: () => set({ error: null }),
}));

// Synchronize oidc-client-ts background events with Zustand store
if (typeof window !== "undefined") {
  userManager.events.addUserLoaded((loadedUser) => {
    persistTokens(loadedUser);
    useAuthStore.setState({
      user: loadedUser,
      isAuthenticated: !loadedUser.expired,
      isLoading: false,
      error: null,
    });
  });

  userManager.events.addUserUnloaded(() => {
    useAuthStore.getState().clearAuthSession();
  });

  userManager.events.addAccessTokenExpiring(() => {
    console.info(
      "Access token is expiring; silent renewal proceeding in background.",
    );
  });

  userManager.events.addSilentRenewError((err) => {
    console.warn("Silent token renewal error:", err);
  });
}
