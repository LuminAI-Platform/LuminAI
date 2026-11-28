import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Search, X } from "../../../lib/icons";
import {
  formatPropertyLabel,
  hasSensitiveProperties,
  isSensitiveField,
  maskSensitiveValue,
} from "../../../pages/explorer/utils";

interface EntityPropertiesSectionProps {
  entityId: string;
  properties: Record<string, unknown>;
  maskSensitiveData: boolean;
}

export const EntityPropertiesSection: React.FC<
  EntityPropertiesSectionProps
> = ({ entityId, properties, maskSensitiveData }) => {
  const [propertySearch, setPropertySearch] = useState("");
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPropertySearch("");
    setRevealedFields(new Set());
  }, [entityId]);

  const propertyEntries = useMemo(
    () => Object.entries(properties),
    [properties],
  );
  const sensitivePresent = useMemo(
    () => hasSensitiveProperties(properties),
    [properties],
  );

  const filteredEntries = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    if (!q) return propertyEntries;
    return propertyEntries.filter(([key, val]) => {
      const label = formatPropertyLabel(key).toLowerCase();
      if (key.toLowerCase().includes(q) || label.includes(q)) return true;
      const sensitive = isSensitiveField(key);
      const isFieldMasked =
        maskSensitiveData && sensitive && !revealedFields.has(key);
      if (isFieldMasked) return false;
      const displayVal = maskSensitiveValue(key, val, false).toLowerCase();
      return displayVal.includes(q);
    });
  }, [propertyEntries, propertySearch, maskSensitiveData, revealedFields]);

  const toggleFieldReveal = (key: string) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSensitiveKeys = useMemo(
    () => propertyEntries.filter(([k]) => isSensitiveField(k)).map(([k]) => k),
    [propertyEntries],
  );

  const allRevealed =
    allSensitiveKeys.length > 0 &&
    allSensitiveKeys.every((k) => revealedFields.has(k));

  const toggleRevealAll = () => {
    if (allRevealed) {
      setRevealedFields(new Set());
    } else {
      setRevealedFields(new Set(allSensitiveKeys));
    }
  };

  return (
    <section aria-labelledby="drawer-properties-heading">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3
          id="drawer-properties-heading"
          className="text-xs font-semibold text-text-secondary"
        >
          {propertySearch.trim()
            ? `Properties (${filteredEntries.length} of ${propertyEntries.length})`
            : `Properties (${propertyEntries.length})`}
        </h3>
        {maskSensitiveData && sensitivePresent && (
          <button
            type="button"
            onClick={toggleRevealAll}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-text-secondary hover:text-text bg-surface-subtle hover:bg-surface-hover border border-border transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
          >
            {allRevealed ? (
              <>
                <EyeOff size={12} aria-hidden="true" />
                <span>Hide all</span>
              </>
            ) : (
              <>
                <Eye size={12} aria-hidden="true" />
                <span>Reveal all</span>
              </>
            )}
          </button>
        )}
      </div>

      {propertyEntries.length > 0 && (
        <div className="relative flex items-center mb-2.5">
          <Search
            size={13}
            className="absolute left-2.5 text-text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
            placeholder="Filter properties..."
            aria-label="Filter properties"
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface-subtle border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors duration-150 motion-reduce:transition-none"
          />
          {propertySearch && (
            <button
              type="button"
              onClick={() => setPropertySearch("")}
              aria-label="Clear property filter"
              className="absolute right-2 text-text-muted hover:text-text cursor-pointer"
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {propertyEntries.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center border border-dashed border-border rounded-xl">
          No source properties recorded for this entity.
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center border border-dashed border-border rounded-xl">
          No properties match &ldquo;{propertySearch.trim()}&rdquo;.
        </p>
      ) : (
        <dl className="divide-y divide-border-subtle border border-border rounded-xl overflow-hidden bg-surface">
          {filteredEntries.map(([key, val]) => {
            const label = formatPropertyLabel(key);
            const sensitive = isSensitiveField(key);
            const hasVal =
              val !== null && val !== undefined && String(val).trim() !== "";
            const isRevealed = revealedFields.has(key);
            const isFieldMasked = maskSensitiveData && sensitive && !isRevealed;
            const displayVal = maskSensitiveValue(key, val, isFieldMasked);

            return (
              <div
                key={key}
                className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-xs items-baseline"
              >
                <dt
                  title={key}
                  className="font-medium text-text-secondary truncate"
                >
                  {label}
                </dt>
                <dd className="flex items-baseline justify-between gap-2 min-w-0">
                  <span
                    className={`text-text break-words min-w-0 ${
                      isFieldMasked
                        ? "font-mono tracking-wider text-text-secondary"
                        : "font-medium"
                    }`}
                  >
                    {displayVal}
                  </span>
                  {maskSensitiveData && sensitive && hasVal && (
                    <button
                      type="button"
                      onClick={() => toggleFieldReveal(key)}
                      aria-label={
                        isRevealed ? `Hide ${label}` : `Reveal ${label}`
                      }
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-primary hover:bg-primary-tint shrink-0 transition-colors duration-150 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {isRevealed ? (
                        <>
                          <EyeOff size={11} aria-hidden="true" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye size={11} aria-hidden="true" />
                          <span>Reveal</span>
                        </>
                      )}
                    </button>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
};
