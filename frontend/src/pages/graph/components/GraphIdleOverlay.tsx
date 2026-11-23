import React from "react";
import { Icons } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import type { SuggestedEntity } from "../graphDataUtils";

interface GraphIdleOverlayProps {
  suggestedEntities: SuggestedEntity[];
  onSelectEntity: (id: string, label?: string) => void;
  onFocusSearch?: () => void;
}

export const GraphIdleOverlay: React.FC<GraphIdleOverlayProps> = ({
  suggestedEntities,
  onSelectEntity,
  onFocusSearch,
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-xs text-center p-6">
      <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary mb-3">
        <Icons.KnowledgeGraph size={24} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-text">
        Choose an entity to explore
      </h3>
      <p className="text-xs text-text-secondary max-w-md mt-1 mb-4 leading-relaxed">
        Search by entity name or ID above and press Load, or pick a suggested
        entity below to inspect its neighborhood.
      </p>

      {suggestedEntities.length > 0 ? (
        <div className="w-full max-w-lg">
          <p className="text-[11px] font-medium text-text-muted mb-2">
            Suggested entities
          </p>
          <div
            className="flex flex-wrap items-center justify-center gap-2"
            role="list"
            aria-label="Suggested entities"
          >
            {suggestedEntities.slice(0, 5).map((entity) => {
              const color = getEntityColor(entity.entityType, isDark);
              return (
                <button
                  key={entity.id}
                  type="button"
                  role="listitem"
                  onClick={() =>
                    onSelectEntity(entity.id, entity.canonicalName)
                  }
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-border-focus hover:bg-surface-hover text-xs text-text font-medium shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="max-w-[160px] truncate">
                    {entity.canonicalName}
                  </span>
                  <span className="text-[10px] text-text-secondary px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                    {entity.entityType}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        onFocusSearch && (
          <Button size="sm" variant="secondary" onClick={onFocusSearch}>
            Focus search bar
          </Button>
        )
      )}
    </div>
  );
};
