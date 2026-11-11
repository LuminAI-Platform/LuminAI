import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/ui/ToastProvider";
import type {
  SourceColumn,
  OntologyProperty,
  SchemaMappingPayload,
} from "../../../features/connections/components/VisualSchemaMapper";
import {
  sanitizeEntityName,
  sanitizePropertyName,
  inferPropertyType,
} from "./schemaMapHelpers";
import type { DomainTemplate } from "./domainTemplates";
import { parseConnectorSources } from "./parseConnectorSources";
import { computeInitialMapperLinks } from "./initialMapperLinks";
import { useDynamicOntology } from "./useDynamicOntology";
import { useSavedMappings } from "./useSavedMappings";

export function useSchemaMapState() {
  const [sources, setSources] = useState<
    Record<string, { table: string; columns: SourceColumn[] }>
  >({});
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [isEntityEditorOpen, setIsEntityEditorOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [generatingFromDataset, setGeneratingFromDataset] = useState(false);
  const [seedingDomain, setSeedingDomain] = useState<string | null>(null);

  const toast = useToast();

  const {
    dynamicOntologyMap,
    dynamicOntologyLabels,
    loadingOntology,
    selectedOntology,
    setSelectedOntology,
    fetchOntologyTypes,
  } = useDynamicOntology();

  const { savedMappings, setSavedMappings, rawDbMappings, setRawDbMappings } =
    useSavedMappings();

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await apiFetch("/api/v1/connections");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const { newSources, newLabels } = parseConnectorSources(list);
            setSources(newSources);
            setSourceLabels(newLabels);

            const preferredId =
              new URLSearchParams(window.location.search).get("connectionId") ||
              localStorage.getItem("lumin_selected_connection_id");

            if (preferredId) {
              const matchKey = Object.keys(newSources).find((k) =>
                k.includes(preferredId),
              );
              setSelectedSource(matchKey || `conn_${list[0].id}`);
              localStorage.removeItem("lumin_selected_connection_id");
            } else if (list.length > 0) {
              setSelectedSource(`conn_${list[0].id}`);
            }
          }
        }
      } catch {
        // Fallback
      }
    };
    fetchConnections();
  }, []);

  const sourceData = useMemo(
    () => sources[selectedSource] || { table: "", columns: [] },
    [sources, selectedSource],
  );
  const activeOntologyKey = useMemo(
    () =>
      selectedOntology && dynamicOntologyMap[selectedOntology]
        ? selectedOntology
        : Object.keys(dynamicOntologyMap)[0] || "",
    [selectedOntology, dynamicOntologyMap],
  );
  const ontologyProps = useMemo(
    () => dynamicOntologyMap[activeOntologyKey] ?? [],
    [dynamicOntologyMap, activeOntologyKey],
  );

  const initialMapperLinks = useMemo(
    () =>
      computeInitialMapperLinks(
        sourceData,
        ontologyProps,
        rawDbMappings,
        selectedSource,
        activeOntologyKey,
      ),
    [
      rawDbMappings,
      sourceData,
      ontologyProps,
      selectedSource,
      activeOntologyKey,
    ],
  );

  const handleSave = (payload: SchemaMappingPayload) => {
    setSavedMappings((prev) => [payload, ...prev.slice(0, 4)]);
    const newRaws = payload.mappings.map(
      (m: { sourceColumnId: string; ontologyPropertyId: string }) => {
        const col = sourceData.columns.find((c) => c.id === m.sourceColumnId);
        const prop = ontologyProps.find(
          (p: OntologyProperty) => p.id === m.ontologyPropertyId,
        );
        return {
          connectorId: selectedSource.replace(/^conn_/, ""),
          name: `${sourceData.table} - ${col?.name ?? m.sourceColumnId} Map`,
          sourceColumn: col?.name ?? m.sourceColumnId,
          targetEntityType: payload.targetEntity,
          targetProperty: prop?.name ?? m.ontologyPropertyId,
          createdAt: new Date().toISOString(),
        };
      },
    );
    setRawDbMappings((prev) => [...newRaws, ...prev]);
  };

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
    sources,
    sourceLabels,
    selectedSource,
    setSelectedSource,
    selectedOntology,
    setSelectedOntology,
    savedMappings,
    rawDbMappings,
    showHistory,
    setShowHistory,
    dynamicOntologyMap,
    dynamicOntologyLabels,
    loadingOntology,
    isEntityEditorOpen,
    setIsEntityEditorOpen,
    isSeedModalOpen,
    setIsSeedModalOpen,
    generatingFromDataset,
    seedingDomain,
    sourceData,
    activeOntologyKey,
    ontologyProps,
    initialMapperLinks,
    handleSave,
    handleAutoGenerateFromDataset,
    handleSeedDomainTemplate,
    fetchOntologyTypes,
  };
}
