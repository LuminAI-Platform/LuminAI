import React, { useState, useEffect } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Icons, ICON_SIZES } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import type {
  RelationshipCardinality,
  RelationshipType,
  EntityTypeOption,
} from "./relationship-editor/relationshipTypes";
import { EMPTY_RELATIONSHIP } from "./relationship-editor/relationshipTypes";
import { RelationshipFields } from "./relationship-editor/RelationshipFields";

export type { RelationshipCardinality, RelationshipType };

interface RelationshipTypeFormProps {
  initial?: RelationshipType;
  onClose: () => void;
  onSaved: (rel: RelationshipType) => void;
}

export const RelationshipTypeForm: React.FC<RelationshipTypeFormProps> = ({
  initial,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<RelationshipType>(
    initial ?? EMPTY_RELATIONSHIP,
  );
  const [entityOptions, setEntityOptions] = useState<EntityTypeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/ontology/entity-types")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setEntityOptions(
            (data as Record<string, unknown>[]).map((d) => ({
              id: String(d.id ?? ""),
              name: String(d.name ?? ""),
            })),
          );
        }
      })
      .catch(() => setEntityOptions([]));
  }, []);

  const set = (k: keyof RelationshipType, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Internal name is required.");
      return;
    }
    if (!form.sourceEntityTypeId || !form.targetEntityTypeId) {
      setError("Source and Target entity types must be selected.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = form.id ? "PUT" : "POST";
      const url = form.id
        ? `/api/v1/ontology/relationship-types/${form.id}`
        : "/api/v1/ontology/relationship-types";
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          sourceEntityTypeId: form.sourceEntityTypeId,
          targetEntityTypeId: form.targetEntityTypeId,
          cardinality: form.cardinality,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.message ||
            errBody.detail ||
            `Failed to save relationship type (HTTP ${res.status}).`,
        );
      }
      const saved = (await res.json()) as RelationshipType;
      onSaved(saved);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save relationship type.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      variant="form"
      title={form.id ? "Edit relationship type" : "New relationship type"}
      description="Define a typed edge between two entity classes."
      icon={
        <div className="w-9 h-9 rounded-full bg-surface-subtle border border-border text-primary flex items-center justify-center shrink-0">
          <Icons.KnowledgeGraph size={ICON_SIZES.card} aria-hidden="true" />
        </div>
      }
      preventClose={saving}
      statusMessage={saving ? "Saving relationship type..." : undefined}
      footer={
        <>
          <Button
            type="button"
            id="rel-form-cancel-btn"
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            id="rel-form-save-btn"
            variant="primary"
            size="sm"
            isLoading={saving}
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving
              ? "Saving..."
              : form.id
                ? "Update relationship"
                : "Create relationship"}
          </Button>
        </>
      }
    >
      <RelationshipFields
        form={form}
        set={set}
        entityOptions={entityOptions}
        error={error}
        onSubmit={handleSubmit}
      />
    </Dialog>
  );
};
