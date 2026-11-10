import React from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, GitBranch } from "lucide-react";
import { EntityPropertyTable } from "../../features/explorer/components/EntityPropertyTable";
import { ProvenanceInspector } from "../../features/explorer/components/ProvenanceInspector";
import {
  EntityHeaderCard,
  GraphCtaBanner,
  EntityLoadingState,
  EntityErrorState,
} from "./components";
import { useEntityDetail } from "./hooks";

// ─── EntityDetailPage ─────────────────────────────────────────────────────────

export const EntityDetailPage: React.FC = () => {
  const { entityId } = useParams({ strict: false }) as { entityId: string };
  const navigate = useNavigate();

  const {
    entity,
    provenance,
    loading,
    error,
    activeProvenanceKey,
    setActiveProvenanceKey,
  } = useEntityDetail(entityId);

  const typeConf = { color: "#3b82f6", icon: "package" };

  const handleExploreGraph = () => {
    void navigate({ to: `/graph`, search: { entityId } });
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return <EntityLoadingState />;
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !entity) {
    return (
      <EntityErrorState
        error={error ?? "The requested entity could not be loaded."}
      />
    );
  }

  return (
    <>
      {/* ── Provenance Inspector Drawer ───────────────────────────────────── */}
      <ProvenanceInspector
        entityId={entityId}
        propertyKey={activeProvenanceKey}
        onClose={() => setActiveProvenanceKey(null)}
      />

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 select-none w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Link
            to="/explorer"
            id="breadcrumb-explorer"
            className="flex items-center gap-1.5 hover:text-blue-400 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Entity Explorer</span>
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 font-medium truncate max-w-xs">
            {entity.canonicalName}
          </span>
        </div>

        {/* Entity Header Card */}
        <EntityHeaderCard
          canonicalName={entity.canonicalName}
          entityType={entity.entityType}
          entityId={entity.id}
          createdAt={entity.createdAt}
          typeColor={typeConf.color}
          typeIcon={typeConf.icon}
          onExploreGraph={handleExploreGraph}
        />

        {/* Properties Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-zinc-200">
                Properties & Provenance
              </h2>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-md">
                {Object.keys(entity.properties).length} attributes
              </span>
            </div>
            <span className="text-[10px] text-zinc-600 italic flex items-center gap-1">
              <span className="w-2.5 h-2.5 text-zinc-500 inline-block">
                <GitBranch className="w-2.5 h-2.5" />
              </span>
              Click provenance icon to inspect source lineage
            </span>
          </div>

          <EntityPropertyTable
            properties={entity.properties}
            provenance={provenance}
            onProvenanceClick={(key) => {
              setActiveProvenanceKey((prev) => (prev === key ? null : key));
            }}
            activeKey={activeProvenanceKey}
          />
        </div>

        {/* Graph CTA Banner */}
        <GraphCtaBanner onExploreGraph={handleExploreGraph} />
      </div>
    </>
  );
};

export default EntityDetailPage;
