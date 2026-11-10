import React from "react";
import { LogOut, Sliders } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  UserProfileCard,
  TenantContextCard,
  ApiKeyCard,
  SystemCapabilitiesCard,
} from "./components";
import { useSettings } from "./hooks";

/**
 * Production Settings & Identity Management Page
 */
export const SettingsPage: React.FC = () => {
  const {
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
  } = useSettings();

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-10 w-full">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Configuration", to: "/settings" },
          { label: "Workspace Settings" },
        ]}
        title="Workspace & Tenant Settings"
        description="Manage authenticated user identity, multi-tenant boundaries, access control roles, and API configuration."
        icon={<Sliders className="w-5 h-5 text-zinc-400" />}
        badge={{
          label: "Tenant Settings",
          variant: "zinc",
        }}
        actions={
          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. User Profile Section */}
        <UserProfileCard
          userName={userName}
          userEmail={userEmail}
          roles={roles}
        />

        {/* 2. Tenant Context Section */}
        <TenantContextCard tenantSlug={tenantSlug} tenantId={tenantId} />
      </div>

      {/* 3. API Key Management */}
      <ApiKeyCard
        displayedKey={displayedKey}
        isKeyVisible={isKeyVisible}
        onToggleKeyVisibility={() => setIsKeyVisible((prev) => !prev)}
        copiedKey={copiedKey}
        onCopyKey={handleCopyKey}
        onRollKeyClick={() => setIsConfirmOpen(true)}
        apiKeyData={apiKeyData}
      />

      {/* 4. System Capabilities & Engine Preferences */}
      <SystemCapabilitiesCard />

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

export default SettingsPage;
