export interface AuthMeResponse {
  userId?: string;
  email?: string;
  name?: string;
  tenantId?: string;
  tenantSlug?: string;
  roles?: { roles?: string[] };
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

export interface ApiKeysResponse {
  hasKey: boolean;
  key?: ApiKeyInfo;
}

export interface SystemCapability {
  label: string;
  value: string;
}

export interface UseSettingsResult {
  userName: string;
  userEmail: string;
  tenantSlug: string;
  tenantId: string;
  roles: string[];
  displayedKey: string;
  isKeyVisible: boolean;
  setIsKeyVisible: React.Dispatch<React.SetStateAction<boolean>>;
  copiedKey: boolean;
  isRegenerating: boolean;
  isConfirmOpen: boolean;
  setIsConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  apiKeyData: ApiKeysResponse | undefined;
  handleCopyKey: () => void;
  handleRegenerateKey: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

export interface UserProfileCardProps {
  userName: string;
  userEmail: string;
  roles: string[];
}

export interface TenantContextCardProps {
  tenantSlug: string;
  tenantId: string;
}

export interface ApiKeyCardProps {
  displayedKey: string;
  isKeyVisible: boolean;
  onToggleKeyVisibility: () => void;
  copiedKey: boolean;
  onCopyKey: () => void;
  onRollKeyClick: () => void;
  apiKeyData?: ApiKeysResponse;
}
