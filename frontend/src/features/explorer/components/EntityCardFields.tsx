import React from "react";
import { sanitizeHtml } from "../../../lib/sanitize";
import {
  isSensitiveField,
  maskSensitiveValue,
  type KeyCardField,
} from "../../../pages/explorer/utils";

interface EntityCardFieldsProps {
  keyFields: KeyCardField[];
  isMasked: boolean;
  highlights?: Record<string, string[]>;
}

export const EntityCardFields: React.FC<EntityCardFieldsProps> = ({
  keyFields,
  isMasked,
  highlights,
}) => {
  if (keyFields.length === 0) return null;

  return (
    <dl className="relative z-10 pointer-events-none grid grid-cols-2 gap-x-4 gap-y-2.5 py-3 border-t border-b border-border-subtle">
      {keyFields.map((field) => {
        const sensitive = !field.isSystemDate && isSensitiveField(field.key);
        const rawHighlight =
          !isMasked &&
          (highlights?.[field.key]?.[0] ||
            highlights?.[`properties.${field.key}`]?.[0]);

        const displayValue = field.isSystemDate
          ? String(field.value)
          : maskSensitiveValue(field.key, field.value, isMasked);

        return (
          <div key={field.key} className="min-w-0 flex flex-col gap-0.5">
            <dt className="text-[11px] text-text-muted font-medium truncate">
              {field.label}
            </dt>
            <dd
              className={`text-xs text-text font-medium truncate ${
                sensitive && isMasked
                  ? "font-mono tracking-wider text-text-secondary"
                  : ""
              }`}
            >
              {rawHighlight ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(rawHighlight),
                  }}
                  className="[&>em]:bg-primary-tint [&>em]:text-primary [&>em]:not-italic [&>em]:font-semibold [&>em]:px-0.5 [&>em]:rounded"
                />
              ) : (
                displayValue
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
