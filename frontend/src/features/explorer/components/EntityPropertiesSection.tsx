import React from "react";
import { Eye, EyeOff } from "../../../lib/icons";
import {
  formatPropertyLabel,
  hasSensitiveProperties,
  isSensitiveField,
  maskSensitiveValue,
} from "../../../pages/explorer/utils";

interface EntityPropertiesSectionProps {
  properties: Record<string, unknown>;
  maskSensitiveData: boolean;
  localReveal: boolean;
  onToggleReveal: () => void;
}

export const EntityPropertiesSection: React.FC<
  EntityPropertiesSectionProps
> = ({ properties, maskSensitiveData, localReveal, onToggleReveal }) => {
  const propertyEntries = Object.entries(properties);
  const sensitivePresent = hasSensitiveProperties(properties);
  const isMasked = maskSensitiveData && !localReveal;

  return (
    <section aria-labelledby="drawer-properties-heading">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3
          id="drawer-properties-heading"
          className="text-xs font-bold uppercase tracking-wider text-text-muted"
        >
          Properties ({propertyEntries.length})
        </h3>
        {maskSensitiveData && sensitivePresent && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text bg-surface-subtle hover:bg-surface-hover border border-border transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
          >
            {localReveal ? (
              <>
                <EyeOff size={13} aria-hidden="true" />
                <span>Mask sensitive</span>
              </>
            ) : (
              <>
                <Eye size={13} aria-hidden="true" />
                <span>Reveal sensitive</span>
              </>
            )}
          </button>
        )}
      </div>

      {propertyEntries.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center border border-dashed border-border rounded-xl">
          No properties recorded for this entity.
        </p>
      ) : (
        <dl className="divide-y divide-border-subtle border border-border rounded-xl overflow-hidden bg-surface">
          {propertyEntries.map(([key, val]) => {
            const sensitive = isSensitiveField(key);
            const displayVal = maskSensitiveValue(key, val, isMasked);
            return (
              <div
                key={key}
                className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-xs items-baseline"
              >
                <dt
                  title={key}
                  className="font-medium text-text-secondary truncate"
                >
                  {formatPropertyLabel(key)}
                </dt>
                <dd
                  className={`text-text break-words ${
                    sensitive && isMasked
                      ? "font-mono tracking-wider text-text-secondary"
                      : "font-medium"
                  }`}
                >
                  {displayVal}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
};
