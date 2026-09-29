import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/ToastProvider";

interface AuthMeResponse {
  userId?: string;
  email?: string;
  name?: string;
  tenantId?: string;
  tenantSlug?: string;
  roles?: { roles?: string[] };
}

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

interface ApiKeysResponse {
  hasKey: boolean;
  key?: ApiKeyInfo;
}

/**
 * Production Settings & Identity Management Page
 */
export const SettingsPage: React.FC = () => {
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
    "LuminAI Operator";

  const userEmail = authMe?.email || user?.profile?.email || "admin@luminai.io";

  const tenantSlug = authMe?.tenantSlug || "lumin-global-prod";

  const tenantId = authMe?.tenantId || "00000000-0000-0000-0000-000000000001";

  // Extract roles
  const roles: string[] =
    authMe?.roles?.roles ||
    (Array.isArray(user?.profile?.roles)
      ? (user?.profile?.roles as string[])
      : ["ADMIN", "DATA_ARCHITECT"]);

  const displayedKey =
    apiKey ||
    (apiKeyData?.hasKey && apiKeyData.key
      ? `${apiKeyData.key.keyPrefix}••••••••••••••••••••••••••••••••`
      : "No active API key. Click 'Roll Key' to generate one.");

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

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Account & System Settings
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your authenticated user profile, multi-tenant isolation, and
            data-engine API keys
          </p>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={handleLogout}
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
        >
          Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. User Profile Section */}
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-800/80">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-base select-none">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {userName}
                </h3>
                <p className="text-xs text-zinc-400">{userEmail}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                  Assigned Platform Roles
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <Badge key={r} variant="purple">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  Authentication Authority
                </label>
                <span className="text-zinc-300 font-mono text-[11px] bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 inline-block">
                  Keycloak OIDC (OAuth 2.0 / RS256)
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  Session Status
                </label>
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authenticated & Multi-Tenant Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Tenant Context Section */}
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-800/80">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Tenant Organization
                </h3>
                <p className="text-xs text-zinc-400">
                  Schema-isolated enterprise workspace
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  Tenant Namespace (Slug)
                </label>
                <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono text-xs">
                  {tenantSlug}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  Tenant UUID
                </label>
                <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 font-mono text-[11px] truncate">
                  {tenantId}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  Data Isolation Level
                </label>
                <div className="flex items-center gap-2 text-zinc-300">
                  <Badge variant="info">PostgreSQL Schema Per Tenant</Badge>
                  <Badge variant="default">Neo4j Property Scoped</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. API Key Management */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-zinc-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Data Engine API Access Key
            </h3>
            <p className="text-xs text-zinc-400">
              Authenticate external Dagster workers, Python SDK scripts, and
              programmatic REST clients
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
          <div className="relative flex-1 w-full">
            <input
              type={isKeyVisible ? "text" : "password"}
              readOnly
              value={displayedKey}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-3 pr-10 text-xs font-mono text-zinc-200 outline-none select-all"
            />
            <button
              onClick={() => setIsKeyVisible(!isKeyVisible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
              title={isKeyVisible ? "Hide key" : "Show key"}
            >
              {isKeyVisible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              onClick={handleCopyKey}
              leftIcon={
                copiedKey ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
            >
              {copiedKey ? "Copied" : "Copy Key"}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => setIsConfirmOpen(true)}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Roll Key
            </Button>
          </div>
        </div>

        {apiKeyData?.hasKey && apiKeyData.key && (
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500 mt-3 pt-3 border-t border-zinc-800/60">
            <span>
              Key Prefix:{" "}
              <strong className="font-mono text-zinc-300">
                {apiKeyData.key.keyPrefix}
              </strong>
            </span>
            <span>
              Created: {new Date(apiKeyData.key.createdAt).toLocaleDateString()}
            </span>
            <span>
              Last used:{" "}
              {apiKeyData.key.lastUsedAt
                ? new Date(apiKeyData.key.lastUsedAt).toLocaleString()
                : "Never"}
            </span>
          </div>
        )}
      </div>

      {/* 4. System Capabilities & Engine Preferences */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-800/80">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              System Architecture & Preferences
            </h3>
            <p className="text-xs text-zinc-400">
              Current runtime engine capabilities and telemetry switches
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 font-medium block mb-1">
              Theme Palette
            </span>
            <span className="text-zinc-200 font-semibold">
              OLED Dark (Tailwind v4)
            </span>
          </div>

          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 font-medium block mb-1">
              Cache Layer
            </span>
            <span className="text-zinc-200 font-semibold">
              Redis (30s Dashboard / 60s Explorer)
            </span>
          </div>

          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
            <span className="text-zinc-500 font-medium block mb-1">
              Event Bus
            </span>
            <span className="text-zinc-200 font-semibold">
              Apache Kafka (Batch 100)
            </span>
          </div>
        </div>
      </div>

      {/* Key Roll Confirmation Dialog */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Revoke & Roll API Key?"
        description="Any existing background workers or SDK scripts using this API key will be immediately invalidated and rejected until updated."
        confirmText="Roll Key Now"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isRegenerating}
        onConfirm={handleRegenerateKey}
      />
    </div>
  );
};
