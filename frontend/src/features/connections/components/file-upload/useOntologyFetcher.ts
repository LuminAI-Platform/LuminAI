import { useState, useEffect } from "react";
import { apiFetch } from "../../../../lib/api";

export interface OntologyFetchResult {
  ontologyEntityTypes: string[];
  ontologyProperties: Record<string, string[]>;
  backendEntityTypes: string[];
  setOntologyEntityTypes: React.Dispatch<React.SetStateAction<string[]>>;
  setOntologyProperties: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;
}

export function useOntologyFetcher(): OntologyFetchResult {
  const [ontologyEntityTypes, setOntologyEntityTypes] = useState<string[]>([]);
  const [backendEntityTypes, setBackendEntityTypes] = useState<string[]>([]);
  const [ontologyProperties, setOntologyProperties] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    const fetchOntology = async () => {
      try {
        const res = await apiFetch("/api/v1/ontology/entity-types");
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const types: string[] = [];
            const propsMap: Record<string, string[]> = {};
            list.forEach(
              (item: {
                name?: string;
                label?: string;
                properties?: Array<{ name: string }>;
              }) => {
                const name = item.name || item.label;
                if (name && name.toLowerCase() !== "csv") {
                  types.push(name);
                  propsMap[name] = Array.isArray(item.properties)
                    ? item.properties.map((p) => p.name)
                    : [];
                }
              },
            );
            if (types.length > 0) {
              setBackendEntityTypes(types);
              setOntologyEntityTypes(types);
              setOntologyProperties(propsMap);
            }
          }
        }
      } catch {
        // Leave empty when ontology service is unreachable
      }
    };
    fetchOntology();
  }, []);

  return {
    ontologyEntityTypes,
    ontologyProperties,
    backendEntityTypes,
    setOntologyEntityTypes,
    setOntologyProperties,
  };
}
