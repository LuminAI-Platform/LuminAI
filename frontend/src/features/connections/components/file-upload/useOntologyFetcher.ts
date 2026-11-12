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

const DEFAULT_ENTITY_TYPES = ["User", "Product", "Transaction", "Organization"];
const DEFAULT_PROPERTIES: Record<string, string[]> = {
  User: ["id", "name", "email", "created_at", "role", "status"],
  Product: ["id", "sku", "name", "price", "stock_quantity", "category"],
  Transaction: ["id", "amount", "timestamp", "user_id", "status"],
  Organization: ["id", "name", "industry", "employee_count", "country"],
};

export function useOntologyFetcher(): OntologyFetchResult {
  const [ontologyEntityTypes, setOntologyEntityTypes] =
    useState<string[]>(DEFAULT_ENTITY_TYPES);
  const [backendEntityTypes, setBackendEntityTypes] = useState<string[]>([]);
  const [ontologyProperties, setOntologyProperties] =
    useState<Record<string, string[]>>(DEFAULT_PROPERTIES);

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
                    : ["id", "name", "created_at"];
                }
              },
            );
            if (types.length > 0) {
              setBackendEntityTypes(types);
              setOntologyEntityTypes(types);
              setOntologyProperties((prev) => ({ ...prev, ...propsMap }));
            }
          }
        }
      } catch {
        // Retain defaults
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
