import { useAuthStore } from "../stores/authStore";
import { showToastNotification } from "../components/ui/ToastProvider";

let isHandlingUnauthorized = false;

/**
 * Reads the current JWT access token from the Zustand auth store.
 * Returns `null` when the user is not authenticated.
 */
export function getAccessToken(): string | null {
  const { user } = useAuthStore.getState();
  if (user?.access_token) {
    return user.access_token;
  }
  if (typeof localStorage !== "undefined") {
    return (
      localStorage.getItem("lumin_access_token") ||
      localStorage.getItem("token") ||
      null
    );
  }
  return null;
}

/**
 * Handles a 401 Unauthorized response by attempting silent token renewal and
 * retrying the original request once. If renewal fails, clears the local auth
 * session and surfaces a non-blocking warning toast.
 */
export async function handleUnauthorizedResponse(
  url: RequestInfo | URL,
  resolvedInit: RequestInit,
): Promise<Response | null> {
  try {
    const { refreshToken, isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      console.info(
        "[API] 401 encountered. Attempting silent token renewal and request retry...",
      );
      const newToken = await refreshToken();
      if (newToken) {
        const retryHeaders = new Headers(resolvedInit.headers);
        if (
          !retryHeaders.has("Content-Type") &&
          !(resolvedInit.body instanceof FormData)
        ) {
          retryHeaders.set("Content-Type", "application/json");
        }
        retryHeaders.set("Authorization", `Bearer ${newToken}`);

        const retryResponse = await fetch(url, {
          ...resolvedInit,
          headers: retryHeaders,
          _isRetry: true,
        } as RequestInit);

        if (retryResponse.ok) {
          return retryResponse;
        }
      }
    }
  } catch (retryErr) {
    console.warn("[API] Token refresh during 401 retry failed:", retryErr);
  }

  if (!isHandlingUnauthorized) {
    isHandlingUnauthorized = true;
    try {
      const { isAuthenticated, clearAuthSession } = useAuthStore.getState();
      if (isAuthenticated) {
        console.warn(
          "401 Unauthorized encountered and renewal failed. Clearing local session without window redirect.",
        );
        clearAuthSession();
        showToastNotification(
          "warning",
          "Session Expired",
          "Your session has ended. Please sign in again.",
        );
      }
    } catch (err) {
      console.error("Failed to reset auth store state on 401:", err);
    } finally {
      isHandlingUnauthorized = false;
    }
  }

  return null;
}
