import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { Search, RefreshCw, Plus, ICON_MAP, ICON_SIZES } from "../../lib/icons";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import {
  createDataset,
  fetchDatasets,
} from "../../features/datasets/datasetApi";
import type { Dataset, DatasetLayer } from "../../features/datasets/types";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLayer, setNewLayer] = useState<DatasetLayer>("RAW");
  const [newStorageLocation, setNewStorageLocation] = useState("");

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

  const createMutation = useMutation({
    mutationFn: () =>
      createDataset({
        name: newName.trim(),
        displayName: newDisplayName.trim() || newName.trim(),
        description: newDescription.trim() || undefined,
        layer: newLayer,
        projectType:
          newLayer === "RAW"
            ? "SOURCE"
            : newLayer === "WORKING"
              ? "PREPARATION"
              : "TRANSFORMATION",
        storageLocation: newStorageLocation.trim() || undefined,
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setNewName("");
      setNewDisplayName("");
      setNewDescription("");
      setNewStorageLocation("");
      void refetch();
    },
  });

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Datasets" }]}
        title="Dataset Management & Catalog"
        description="Governed dataset catalog spanning Raw, Working, Prepared, Curated, and Model-Ready tiers."
        icon={
          <ICON_MAP.nav.datasetCatalog
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Register Dataset
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending) setCreateOpen(false);
        }}
        variant="form"
        title="Register Catalog Dataset"
        description="Register a governed dataset entry manually in the catalog."
        preventClose={createMutation.isPending}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={createMutation.isPending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-dataset-form"
              variant="primary"
              size="sm"
              disabled={!newName.trim() || createMutation.isPending}
              isLoading={createMutation.isPending}
            >
              Create Dataset
            </Button>
          </>
        }
      >
        <form
          id="create-dataset-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate();
          }}
          className="flex flex-col gap-3"
        >
          {createMutation.isError && (
            <div className="p-2.5 rounded-lg border border-error/30 bg-error/10 text-error text-xs">
              {(createMutation.error as Error)?.message ||
                "Failed to register dataset"}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text">
              Technical Name *
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. customer_orders_curated"
              className="bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text">
              Display Name
            </label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Customer Orders Curated"
              className="bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs text-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text">Tier</label>
              <select
                value={newLayer}
                onChange={(e) => setNewLayer(e.target.value as DatasetLayer)}
                className="bg-surface-subtle border border-border rounded-lg px-2.5 py-1.5 text-xs text-text"
              >
                {TIER_FILTERS.filter((l) => l !== "ALL").map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text">
                Storage Key (Optional)
              </label>
              <input
                type="text"
                value={newStorageLocation}
                onChange={(e) => setNewStorageLocation(e.target.value)}
                placeholder="tenant-uuid/raw/file.csv"
                className="bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-text"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text">Description</label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="bg-surface-subtle border border-border rounded-lg px-3 py-1.5 text-xs text-text"
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default DatasetsPage;
