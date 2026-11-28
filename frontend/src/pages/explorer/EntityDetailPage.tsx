import React from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, GitBranch } from "../../lib/icons";
import { EntityPropertyTable } from "../../features/explorer/components/EntityPropertyTable";
import { ProvenanceInspector } from "../../features/explorer/components/ProvenanceInspector";
import {
  EntityHeaderCard,
  GraphCtaBanner,
  EntityLoadingState,
  EntityErrorState,
} from "./components";
import { getEntityColor } from "../../lib/entityColors";
import { useThemeStore } from "../../stores/themeStore";
import { useEntityDetail } from "./hooks";
import { extractQualityMetadata, resolveEntityLabel } from "./utils";

// ─── EntityDetailPage ─────────────────────────────────────────────────────────

export const EntityDetailPage: React.FC = () => {
  const { entityId } = useParams({ strict: false }) as { entityId: string };
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);

  const {
    entity,
    provenance,
    loading,
    error,
    activeProvenanceKey,
    setActiveProvenanceKey,
  } = useEntityDetail(entityId);

  const typeConf = {
    color: getEntityColor(entity?.entityType ?? "", isDark),
    icon: entity?.entityType?.toLowerCase() || "database",
  };

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

  const { sourceProperties } = extractQualityMetadata(entity.properties);
  const displayLabel = resolveEntityLabel({
    id: entity.id,
    canonicalName: entity.canonicalName,
    entityType: entity.entityType,
    properties: sourceProperties,
  });

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
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link
            to="/explorer"
            id="breadcrumb-explorer"
            className="flex items-center gap-1.5 hover:text-primary transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Entity Explorer</span>
          </Link>
          <span className="text-border">/</span>
          <span className="text-text-secondary font-medium truncate max-w-xs">
            {displayLabel}
          </span>
        </div>

        {/* Entity Header Card */}
        <EntityHeaderCard
          canonicalName={displayLabel}
          entityType={entity.entityType}
          entityId={entity.id}
          createdAt={entity.createdAt ?? ""}
          typeColor={typeConf.color}
          typeIcon={typeConf.icon}
          onExploreGraph={handleExploreGraph}
        />

        {/* Properties Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-text">
                Properties ({Object.keys(sourceProperties).length})
              </h2>
            </div>
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-text-muted" />
              Click provenance icon to inspect source lineage
            </span>
          </div>

          <EntityPropertyTable
            properties={sourceProperties}
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
