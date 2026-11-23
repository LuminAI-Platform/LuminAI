import React from "react";
import { Key, Copy, Check, Eye, EyeOff, RefreshCw } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import type { ApiKeyCardProps } from "../types";

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  displayedKey,
  isKeyVisible,
  onToggleKeyVisibility,
  copiedKey,
  onCopyKey,
  onRollKeyClick,
  apiKeyData,
}) => {
  const hasCopyableKey = Boolean(
    apiKeyData?.hasKey ||
    (displayedKey && !displayedKey.startsWith("No active")),
  );

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-xs transition-colors">
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center">
          <Key className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text">
            Data Engine API Access Key
          </h3>
          <p className="text-xs text-text-secondary">
            Authenticate external workers, Python SDK scripts, and programmatic
            REST clients
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
        <div className="relative flex-1 w-full">
          <input
            type={isKeyVisible ? "text" : "password"}
            readOnly
            value={displayedKey}
            className="w-full bg-surface-subtle border border-border rounded-lg py-2.5 pl-3 pr-10 text-xs font-mono text-text outline-none select-all"
          />
          <button
            type="button"
            onClick={onToggleKeyVisibility}
            disabled={!hasCopyableKey}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text p-1 cursor-pointer disabled:opacity-40"
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
            disabled={!hasCopyableKey}
            onClick={onCopyKey}
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
            onClick={onRollKeyClick}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Roll Key
          </Button>
        </div>
      </div>

      {apiKeyData?.hasKey && apiKeyData.key && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-secondary mt-3 pt-3 border-t border-border">
          <span>
            Key Prefix:{" "}
            <strong className="font-mono text-text">
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
  );
};
