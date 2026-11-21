import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/ui/ToastProvider";
import type { SourceColumn } from "../../../features/connections/components/VisualSchemaMapper";
import {
  sanitizeEntityName,
  sanitizePropertyName,
  inferPropertyType,
} from "./schemaMapHelpers";
import type { DomainTemplate } from "./domainTemplates";

interface UseSchemaMapEntityActionsOptions {
  sourceData: { table: string; columns: SourceColumn[] };
  fetchOntologyTypes: () => Promise<void>;
  setSelectedOntology: (name: string) => void;
  setIsSeedModalOpen: (open: boolean) => void;
}

export function useSchemaMapEntityActions({
  sourceData,
  fetchOntologyTypes,
  setSelectedOntology,
  setIsSeedModalOpen,
}: UseSchemaMapEntityActionsOptions) {
  const toast = useToast();
  const [generatingFromDataset, setGeneratingFromDataset] = useState(false);
  const [seedingDomain, setSeedingDomain] = useState<string | null>(null);

  const handleAutoGenerateFromDataset = async () => {
    if (!sourceData.columns || sourceData.columns.length === 0) {
      toast.error(
        "Source Required",
        "Please select a data source with columns first.",
      );
      return;
    }

    setGeneratingFromDataset(true);
    try {
      const rawTable = sourceData.table || "NewEntity";
      const entityName = sanitizeEntityName(rawTable);
      const displayLabel = entityName.replace(/([A-Z])/g, " $1").trim();

      const properties = sourceData.columns.map((col) => ({
        name: sanitizePropertyName(col.name),
        type: inferPropertyType(col.dataType),
        required:
          col.nullable === false ||
          col.name.toLowerCase().endsWith("id") ||
          col.name.toLowerCase() === "id",
        defaultValue: null,
        description: col.name,
      }));

      const res = await apiFetch("/api/v1/ontology/entity-types", {
        method: "POST",
        body: JSON.stringify({
          name: entityName,
          label: displayLabel,
          color: "#3b82f6",
          icon: "database",
          description: `Created from ${rawTable}`,
          properties,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to create entity");
      }

      const created = await res.json();
      await fetchOntologyTypes();
      setSelectedOntology(created.name || entityName);
      toast.success(
        "Entity Created",
        `Created '${created.name || entityName}' with ${properties.length} fields.`,
      );
    } catch (err: unknown) {
      toast.error(
        "Creation Failed",
        err instanceof Error ? err.message : "Failed to create entity.",
      );
    } finally {
      setGeneratingFromDataset(false);
    }
  };

  const handleSeedDomainTemplate = async (template: DomainTemplate) => {
    setSeedingDomain(template.id);
    try {
      let createdCount = 0;
      for (const et of template.entityTypes) {
        try {
          const res = await apiFetch("/api/v1/ontology/entity-types", {
            method: "POST",
            body: JSON.stringify(et),
          });
          if (res.ok) createdCount++;
        } catch {
          // ignore
        }
      }

      await fetchOntologyTypes();
      if (template.entityTypes.length > 0) {
        setSelectedOntology(template.entityTypes[0].name);
      }
      setIsSeedModalOpen(false);
      toast.success(
        "Templates Added",
        `Added ${template.name} (${createdCount} entities) to your database.`,
      );
    } catch (err: unknown) {
      toast.error(
        "Template Import Failed",
        err instanceof Error ? err.message : "Failed to add templates.",
      );
    } finally {
      setSeedingDomain(null);
    }
  };

  return {
    generatingFromDataset,
    seedingDomain,
    handleAutoGenerateFromDataset,
    handleSeedDomainTemplate,
  };
}
