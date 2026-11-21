import React from "react";
import { Select } from "../../../../components/ui/dropdown";
import { getEntityColor } from "../../../../lib/entityColors";
import { useThemeStore } from "../../../../stores/themeStore";

interface StepMappingTargetBannerProps {
  ontologyEntityTypes: string[];
  primaryTargetEntity: string;
  inferredEntityName: string;
  isCreatingCustomEntity: boolean;
  customEntityInput: string;
  entityGroupMap: Record<string, string[]>;
  setIsCreatingCustomEntity: (v: boolean) => void;
  setCustomEntityInput: (v: string) => void;
  handlePrimaryEntityChange: (newEntity: string) => void;
  handleApplyCustomEntity: () => void;
}

export const StepMappingTargetBanner: React.FC<
  StepMappingTargetBannerProps
> = ({
  ontologyEntityTypes,
  primaryTargetEntity,
  inferredEntityName,
  isCreatingCustomEntity,
  customEntityInput,
  entityGroupMap,
  setIsCreatingCustomEntity,
  setCustomEntityInput,
  handlePrimaryEntityChange,
  handleApplyCustomEntity,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const configuredEntities = Object.keys(entityGroupMap);
  const totalTypesCount = configuredEntities.length;

  return (
    <>
      {/* Primary Target Entity Banner */}
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
                type="button"
                onClick={handleApplyCustomEntity}
                className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
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

      {/* Entity Preview & Generation Summary Bar */}
      <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5 flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">
              Configured Target Entities:
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                totalTypesCount === 1
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}
            >
              {totalTypesCount === 1
                ? "1 type will be created"
                : `${totalTypesCount} types will be created`}
            </span>
          </div>
          {totalTypesCount === 1 && (
            <span className="text-zinc-500 text-[11px]">
              Tip: Assign columns to different entity types below to generate
              multiple classes.
            </span>
          )}
        </div>

        {/* Entity type preview pills */}
        <div className="flex flex-wrap items-center gap-2">
          {configuredEntities.map((entity) => {
            const count = entityGroupMap[entity].length;
            const color = getEntityColor(entity, isDark);
            return (
              <div
                key={entity}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-semibold text-zinc-200">{entity}</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({count} {count === 1 ? "column" : "columns"})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
