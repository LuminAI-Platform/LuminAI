import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../stores/authStore";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/ui/ToastProvider";
import type {
  AuthMeResponse,
  ApiKeysResponse,
  UseSettingsResult,
} from "../types";
import {
  DEFAULT_USER_NAME,
  DEFAULT_USER_EMAIL,
  DEFAULT_TENANT_SLUG,
  DEFAULT_TENANT_ID,
  DEFAULT_ROLES,
} from "../constants";
import { getDisplayedKey } from "../utils";

/**
 * Custom React hook grouping identity queries, tenant scope resolution,
 * API key encryption/rotation, and session lifecycle side effects.
 */
export function useSettings(): UseSettingsResult {
  const { user, logout } = useAuthStore();
  const toast = useToast();

  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");

  // Query backend /api/v1/settings/api-keys for active enterprise key
  const { data: apiKeyData, refetch: refetchApiKey } =
    useQuery<ApiKeysResponse>({
      queryKey: ["settings", "api-keys"],
      queryFn: async () => {
        const res = await apiFetch("/api/v1/settings/api-keys");
        return res.json();
      },
    });

  // Query backend /api/v1/auth/me for enriched tenant & user metadata
  const { data: authMe } = useQuery<AuthMeResponse>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/auth/me");
      return res.json();
    },
    retry: false,
  });

  const userName =
    authMe?.name ||
    user?.profile?.name ||
    user?.profile?.preferred_username ||
    DEFAULT_USER_NAME;

  const userEmail = authMe?.email || user?.profile?.email || DEFAULT_USER_EMAIL;
  const tenantSlug = authMe?.tenantSlug || DEFAULT_TENANT_SLUG;
  const tenantId = authMe?.tenantId || DEFAULT_TENANT_ID;

  const roles: string[] =
    authMe?.roles?.roles ||
    (Array.isArray(user?.profile?.roles)
      ? (user?.profile?.roles as string[])
      : DEFAULT_ROLES);

  const displayedKey = getDisplayedKey(apiKey, apiKeyData);

  const handleCopyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      toast.success(
        "API Key Copied",
        "The full secret token has been copied to your clipboard.",
      );
      setTimeout(() => setCopiedKey(false), 2500);
    } else if (apiKeyData?.hasKey) {
      toast.warning(
        "Full Key Masked",
        "For cryptographic security, the full secret token is only displayed immediately upon rotation. Please rotate the key to acquire a fresh full token.",
      );
    }
  };

  const handleRegenerateKey = async () => {
    setIsRegenerating(true);
    try {
      const res = await apiFetch("/api/v1/settings/api-keys/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Production Live Key" }),
      });
      const data = await res.json();
      setApiKey(data.apiKey);
      setIsKeyVisible(true);
      setIsConfirmOpen(false);
      refetchApiKey();
      toast.success(
        "API Key Rotated",
        "A new live access token has been generated and activated in PostgreSQL.",
      );
    } catch (err) {
      toast.error(
        "Rotation Failed",
        err instanceof Error ? err.message : "Failed to rotate API key",
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.info("Logged Out", "You have successfully signed out of LuminAI.");
    } catch {
      window.location.href = "/login";
    }
  };

  return {
    userName,
    userEmail,
    tenantSlug,
    tenantId,
    roles,
    displayedKey,
    isKeyVisible,
    setIsKeyVisible,
    copiedKey,
    isRegenerating,
    isConfirmOpen,
    setIsConfirmOpen,
    apiKeyData,
    handleCopyKey,
    handleRegenerateKey,
    handleLogout,
  };
}
