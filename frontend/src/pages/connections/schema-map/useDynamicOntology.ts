import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../../../lib/api";
import type { OntologyProperty } from "../../../features/connections/components/VisualSchemaMapper";
import { parseEntityProperties } from "./schemaMapHelpers";

export function useDynamicOntology() {
  const [dynamicOntologyMap, setDynamicOntologyMap] = useState<
    Record<string, OntologyProperty[]>
  >({});
  const [dynamicOntologyLabels, setDynamicOntologyLabels] = useState<
    Record<string, string>
  >({});
  const [loadingOntology, setLoadingOntology] = useState(true);
  const [selectedOntology, setSelectedOntology] = useState<string>("");

  const fetchOntologyTypes = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/ontology/entity-types");
      if (res.ok) {
        const types = await res.json();
        if (Array.isArray(types) && types.length > 0) {
          const newMap: Record<string, OntologyProperty[]> = {};
          const newLabels: Record<string, string> = {};

          types.forEach((t) => {
            newLabels[t.name] = t.label || t.name;
            newMap[t.name] = parseEntityProperties(t);
          });

          setDynamicOntologyMap(newMap);
          setDynamicOntologyLabels(newLabels);
          setSelectedOntology((prev) =>
            prev && newMap[prev] ? prev : types[0]?.name || "",
          );
        } else {
          setDynamicOntologyMap({});
          setDynamicOntologyLabels({});
          setSelectedOntology("");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch ontology types", err);
    } finally {
      setLoadingOntology(false);
    }
  }, []);

  useEffect(() => {
    fetchOntologyTypes();
  }, [fetchOntologyTypes]);

  return {
    dynamicOntologyMap,
    dynamicOntologyLabels,
    loadingOntology,
    selectedOntology,
    setSelectedOntology,
    fetchOntologyTypes,
  };
}
