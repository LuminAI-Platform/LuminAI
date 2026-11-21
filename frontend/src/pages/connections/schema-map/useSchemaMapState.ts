import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../../../lib/api";
import type {
  SourceColumn,
  OntologyProperty,
  SchemaMappingPayload,
} from "../../../features/connections/components/VisualSchemaMapper";
import { parseConnectorSources } from "./parseConnectorSources";
import { computeInitialMapperLinks } from "./initialMapperLinks";
import { useDynamicOntology } from "./useDynamicOntology";
import { useSavedMappings } from "./useSavedMappings";
import { useSchemaMapEntityActions } from "./useSchemaMapEntityActions";

export function useSchemaMapState() {
  const [sources, setSources] = useState<
    Record<string, { table: string; columns: SourceColumn[] }>
  >({});
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [isEntityEditorOpen, setIsEntityEditorOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);

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

  const {
    generatingFromDataset,
    seedingDomain,
    handleAutoGenerateFromDataset,
    handleSeedDomainTemplate,
  } = useSchemaMapEntityActions({
    sourceData,
    fetchOntologyTypes,
    setSelectedOntology,
    setIsSeedModalOpen,
  });

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
