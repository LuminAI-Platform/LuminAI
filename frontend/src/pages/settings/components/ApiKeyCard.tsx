import React from "react";
import { Key, Copy, Check, Eye, EyeOff, RefreshCw } from "lucide-react";
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
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-zinc-800/80">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
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
            onClick={onToggleKeyVisibility}
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
  );
};
