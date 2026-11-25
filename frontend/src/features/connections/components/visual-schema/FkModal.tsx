import React from "react";
import { Dialog } from "../../../../components/ui/Dialog";
import { Button } from "../../../../components/ui/Button";
import { Select } from "../../../../components/ui/dropdown";
import { Icons, ICON_SIZES } from "../../../../lib/icons";
import type { SourceColumn, ForeignKeyDefinition } from "./visualSchemaTypes";

interface FkModalProps {
  activeCol: SourceColumn;
  targetEntity: string;
  foreignKeys: Record<string, ForeignKeyDefinition>;
  availableEntities: string[];
  availableRelationshipTypes: string[];
  isCustomEntity: boolean;
  setIsCustomEntity: (v: boolean) => void;
  fkTargetEntity: string;
  setFkTargetEntity: (v: string) => void;
  isCustomRel: boolean;
  setIsCustomRel: (v: boolean) => void;
  fkRelType: string;
  setFkRelType: (v: string) => void;
  fkDirection: "OUTGOING" | "INCOMING";
  setFkDirection: (v: "OUTGOING" | "INCOMING") => void;
  onClose: () => void;
  onSave: () => void;
  onRemove: (colId: string) => void;
}

export const FkModal: React.FC<FkModalProps> = ({
  activeCol,
  targetEntity,
  foreignKeys,
  availableEntities,
  availableRelationshipTypes,
  isCustomEntity,
  setIsCustomEntity,
  fkTargetEntity,
  setFkTargetEntity,
  isCustomRel,
  setIsCustomRel,
  fkRelType,
  setFkRelType,
  fkDirection,
  setFkDirection,
  onClose,
  onSave,
  onRemove,
}) => {
  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="form"
      title="Target relationship link"
      description={
        <>
          Define cross-entity graph link for column{" "}
          <span className="font-mono font-semibold text-primary">
            {activeCol.name}
          </span>
        </>
      }
      icon={
        <div className="w-9 h-9 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
          <Icons.KnowledgeGraph size={ICON_SIZES.card} aria-hidden="true" />
        </div>
      }
      footerStart={
        foreignKeys[activeCol.id] ? (
          <Button
            id="fk-modal-remove-btn"
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onRemove(activeCol.id)}
          >
            Remove link
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id="fk-modal-apply-btn"
            type="button"
            variant="primary"
            size="sm"
            onClick={onSave}
          >
            Apply relationship link
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="fk-target-entity-select"
            className="text-xs font-medium text-text"
          >
            Target entity type
          </label>
          <Select
            id="fk-target-entity-select"
            value={isCustomEntity ? "CUSTOM" : fkTargetEntity}
            onChange={(val) => {
              if (val === "CUSTOM") {
                setIsCustomEntity(true);
              } else {
                setIsCustomEntity(false);
                setFkTargetEntity(val);
              }
            }}
            options={[
              ...availableEntities.map((ent) => ({ value: ent, label: ent })),
              { value: "CUSTOM", label: "+ Custom Entity Type…" },
            ]}
            ariaLabel="Target entity type"
            size="sm"
          />
          {isCustomEntity && (
            <input
              id="fk-custom-entity-input"
              type="text"
              placeholder="e.g. Vendor, Merchant, Organization"
              value={fkTargetEntity}
              onChange={(e) => setFkTargetEntity(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-border-focus"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="fk-relation-type-select"
            className="text-xs font-medium text-text"
          >
            Relationship edge type
          </label>
          <Select
            id="fk-relation-type-select"
            value={isCustomRel ? "CUSTOM" : fkRelType}
            onChange={(val) => {
              if (val === "CUSTOM") {
                setIsCustomRel(true);
              } else {
                setIsCustomRel(false);
                setFkRelType(val);
              }
            }}
            options={[
              ...availableRelationshipTypes.map((rel) => ({
                value: rel,
                label: rel,
              })),
              { value: "CUSTOM", label: "+ Custom Relationship…" },
            ]}
            ariaLabel="Relationship edge type"
            size="sm"
          />
          {isCustomRel && (
            <input
              id="fk-custom-relation-input"
              type="text"
              placeholder="e.g. PURCHASED_BY, ISSUED_TO"
              value={fkRelType}
              onChange={(e) =>
                setFkRelType(e.target.value.toUpperCase().replace(/\s+/g, "_"))
              }
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text font-mono uppercase focus:outline-none focus:border-border-focus"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text">
            Graph traversal direction
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              id="fk-direction-outgoing"
              onClick={() => setFkDirection("OUTGOING")}
              className={`px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                fkDirection === "OUTGOING"
                  ? "bg-primary-tint border-primary text-primary"
                  : "bg-surface border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              Outgoing ({targetEntity} → {fkTargetEntity})
            </button>
            <button
              type="button"
              id="fk-direction-incoming"
              onClick={() => setFkDirection("INCOMING")}
              className={`px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                fkDirection === "INCOMING"
                  ? "bg-primary-tint border-primary text-primary"
                  : "bg-surface border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              Incoming ({fkTargetEntity} → {targetEntity})
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
