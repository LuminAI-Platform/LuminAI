import React from "react";
import { Select } from "../../../../components/ui/dropdown";

interface TargetEntityBannerProps {
  primaryTargetEntity: string;
  inferredEntityName: string;
  ontologyEntityTypes: string[];
  isCreatingCustomEntity: boolean;
  customEntityInput: string;
  setIsCreatingCustomEntity: (v: boolean) => void;
  setCustomEntityInput: (v: string) => void;
  handlePrimaryEntityChange: (newEntity: string) => void;
  handleApplyCustomEntity: () => void;
}

export const TargetEntityBanner: React.FC<TargetEntityBannerProps> = ({
  primaryTargetEntity,
  inferredEntityName,
  ontologyEntityTypes,
  isCreatingCustomEntity,
  customEntityInput,
  setIsCreatingCustomEntity,
  setCustomEntityInput,
  handlePrimaryEntityChange,
  handleApplyCustomEntity,
}) => {
  return (
    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 font-bold">
          Ω
        </div>
        <div>
          <div className="font-semibold text-zinc-200 flex items-center gap-2">
            <span>Target Entity:</span>
            <span className="text-zinc-100 font-semibold text-sm">
              {primaryTargetEntity || inferredEntityName || "None"}
            </span>
            {inferredEntityName &&
              primaryTargetEntity === inferredEntityName && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium">
                  Auto-detected
                </span>
              )}
          </div>
          <p className="text-[11px] text-zinc-500">
            All columns map to this Entity Type by default. You can switch
            target entity or fine-tune individual column properties below.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isCreatingCustomEntity ? (
          <>
            <span className="text-zinc-400 text-xs font-medium">
              Change Target:
            </span>
            <div className="w-56">
              <Select
                value={primaryTargetEntity}
                onChange={(val) => handlePrimaryEntityChange(val)}
                options={[
                  ...ontologyEntityTypes
                    .filter((e) => e.toLowerCase() !== "csv")
                    .map((entity) => ({
                      value: entity,
                      label:
                        entity === inferredEntityName
                          ? `${entity} (Inferred from dataset)`
                          : entity,
                    })),
                  {
                    value: "__CREATE_NEW__",
                    label: "+ Create New Entity Type…",
                  },
                ]}
                ariaLabel="Target Entity Type"
                size="sm"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New Entity Name (e.g. StudentSurvey)"
              value={customEntityInput}
              onChange={(e) => setCustomEntityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyCustomEntity();
                if (e.key === "Escape") setIsCreatingCustomEntity(false);
              }}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-text text-xs outline-none focus:border-border-focus w-56 font-mono"
              autoFocus
            />
            <button
              onClick={handleApplyCustomEntity}
              className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setIsCreatingCustomEntity(false);
                setCustomEntityInput("");
              }}
              className="px-2.5 py-1.5 bg-transparent hover:bg-surface-subtle text-text border border-border rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
