import React, { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { apiFetch } from "../../lib/api";
import {
  fetchDatasets,
  fetchSavedQueries,
} from "../../features/datasets/datasetApi";
import { listModels } from "../../features/ml/mlApi";
import {
  GitBranch,
  Plug,
  Wand2,
  GitMerge,
  Shapes,
  Table,
  Cpu,
  ArrowRight,
  ICON_SIZES,
} from "../../lib/icons";

interface ProjectCategory {
  key:
    | "SOURCE"
    | "DATA_PREP"
    | "TRANSFORM"
    | "SEMANTIC"
    | "ANALYTICS"
    | "DATA_SCIENCE";
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
}

const PROJECTS: ProjectCategory[] = [
  {
    key: "SOURCE",
    title: "1. Source Layer (Data Ingestion)",
    badge: "RAW",
    description:
      "External systems, relational databases, event streams, and file syncs preserving exact raw inputs.",
    icon: Plug,
    link: "/connections",
  },
  {
    key: "DATA_PREP",
    title: "2. Data Preparation (Cleaning & Typing)",
    badge: "PREPARED",
    description:
      "Type inference, null resolution, ISO date standardization, and categorical normalization.",
    icon: Wand2,
    link: "/datasets",
  },
  {
    key: "TRANSFORM",
    title: "3. Transformation & Resolution",
    badge: "CURATED",
    description:
      "Deterministic & probabilistic entity resolution, deduplication, and Golden Record compilation.",
    icon: GitMerge,
    link: "/connections/merge-review",
  },
  {
    key: "SEMANTIC",
    title: "4. Semantic Ontology Layer",
    badge: "ONTOLOGY",
    description:
      "Governed real-world object types, relationship links, and operational schema versions.",
    icon: Shapes,
    link: "/ontology",
  },
  {
    key: "ANALYTICS",
    title: "5. Analytics & SQL Workspace",
    badge: "ANALYTICAL",
    description:
      "Interactive SQL studio, time-series rollups, saved query reports, and dashboards.",
    icon: Table,
    link: "/analytics/sql",
  },
  {
    key: "DATA_SCIENCE",
    title: "6. Data Science & Model Registry",
    badge: "MODEL_READY",
    description:
      "Feature stores, model training, cross-validation metrics, and Champion/Challenger registry.",
    icon: Cpu,
    link: "/datascience/models",
  },
];

export const ProjectsLineagePage: React.FC = () => {
  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => fetchDatasets(),
    retry: 1,
  });

  const { data: connections } = useQuery<unknown[]>({
    queryKey: ["connections-count"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/connections");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items ?? data.content ?? []);
    },
    retry: 1,
  });

  const { data: entityTypes } = useQuery<unknown[]>({
    queryKey: ["ontology-entity-types-count"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/ontology/entity-types");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items ?? []);
    },
    retry: 1,
  });

  const { data: savedQueries } = useQuery({
    queryKey: ["saved-queries"],
    queryFn: fetchSavedQueries,
    retry: 1,
  });

  const { data: models } = useQuery({
    queryKey: ["ml-models"],
    queryFn: () => listModels(),
    retry: 1,
  });

  const counts = useMemo<Record<ProjectCategory["key"], number | null>>(() => {
    const byLayer = (layer: string) =>
      datasets ? datasets.filter((d) => d.layer === layer).length : null;
    const rawCount = byLayer("RAW");
    const workingCount = byLayer("WORKING");
    const prepCount = byLayer("PREPARED");
    const curatedCount = byLayer("CURATED");
    const analyticalCount = byLayer("ANALYTICAL");
    const modelReadyCount = byLayer("MODEL_READY");

    return {
      SOURCE:
        connections !== undefined || rawCount !== null
          ? (connections?.length ?? 0) + (rawCount ?? 0)
          : null,
      DATA_PREP:
        workingCount !== null || prepCount !== null
          ? (workingCount ?? 0) + (prepCount ?? 0)
          : null,
      TRANSFORM: curatedCount,
      SEMANTIC: entityTypes !== undefined ? entityTypes.length : null,
      ANALYTICS:
        savedQueries !== undefined || analyticalCount !== null
          ? (savedQueries?.length ?? 0) + (analyticalCount ?? 0)
          : null,
      DATA_SCIENCE:
        models !== undefined || modelReadyCount !== null
          ? (models?.length ?? 0) + (modelReadyCount ?? 0)
          : null,
    };
  }, [datasets, connections, entityTypes, savedQueries, models]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Governance" }, { label: "Projects & Lineage" }]}
        title="Projects & Data Lineage Architecture"
        description="Structured unidirectional data flow from Source Ingestion through Ontology and Analytics to the Model Registry."
        icon={
          <GitBranch size={ICON_SIZES.header} className="text-text-secondary" />
        }
      />

      {/* Visual Architectural Pipeline Flow */}
      <div className="p-6 rounded-xl border border-border bg-surface flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-text">
          Unidirectional Lifecycle Architecture
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
          {[
            "Source",
            "Data Prep",
            "Transform",
            "Ontology",
            "Analytics",
            "Data Science",
          ].map((stage, i) => (
            <div
              key={stage}
              className="p-3 rounded-lg border border-border bg-surface-subtle text-center flex flex-col items-center justify-center gap-1"
            >
              <span className="text-[10px] font-bold text-primary">
                STAGE 0{i + 1}
              </span>
              <span className="text-xs font-semibold text-text">{stage}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Project Structure Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROJECTS.map((proj) => {
          const IconComp = proj.icon;
          return (
            <div
              key={proj.key}
              className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between gap-4 hover:border-primary/50 transition-colors shadow-xs"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {proj.badge}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-text mt-1">
                  {proj.title}
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {proj.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-text-secondary">
                  {counts[proj.key] !== null
                    ? `${counts[proj.key]} ${counts[proj.key] === 1 ? "asset" : "assets"} configured`
                    : "—"}
                </span>
                <Link
                  to={proj.link}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <span>Open Project</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectsLineagePage;
