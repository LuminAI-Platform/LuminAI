import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { Search, RefreshCw, Plus, Database, ICON_SIZES } from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { fetchDatasets } from "../../features/datasets/datasetApi";
import type { Dataset } from "../../features/datasets/types";
import { DatasetKpiSummary } from "./components/DatasetKpiSummary";
import { DatasetCatalogTable } from "./components/DatasetCatalogTable";

const TIER_FILTERS = [
  "ALL",
  "RAW",
  "WORKING",
  "PREPARED",
  "CURATED",
  "ANALYTICAL",
  "MODEL_READY",
];

export const DatasetsPage: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const {
    data: datasets = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<Dataset[]>({
    queryKey: ["datasets", selectedLayer, searchTerm],
    queryFn: () =>
      fetchDatasets({
        layer: selectedLayer === "ALL" ? undefined : selectedLayer,
        search: searchTerm || undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Datasets" }]}
        title="Dataset Management & Catalog"
        description="Governed dataset catalog spanning Raw, Working, Prepared, Curated, and Model-Ready tiers."
        icon={
          <Database
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              isLoading={isRefetching}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
                />
              }
            >
              Refresh
            </Button>
            <Link to="/connections">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Ingest New Dataset
              </Button>
            </Link>
          </div>
        }
      />

      <DatasetKpiSummary datasets={datasets} />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1 rounded-xl bg-surface border border-border">
        <div className="flex items-center gap-1 overflow-x-auto p-1">
          {TIER_FILTERS.map((layer) => (
            <button
              key={layer}
              onClick={() => setSelectedLayer(layer)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedLayer === layer
                  ? "bg-primary text-primary-text font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text hover:bg-surface-subtle"
              }`}
            >
              {layer.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] px-2 py-1">
          <Search className="w-4 h-4 text-text-secondary absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search datasets by name..."
            className="w-full bg-surface-subtle border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text placeholder:text-text-secondary focus:outline-hidden focus:border-primary"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <DatasetCatalogTable
          datasets={datasets}
          isLoading={isLoading}
          selectedLayer={selectedLayer}
        />
      </div>
    </div>
  );
};

export default DatasetsPage;
