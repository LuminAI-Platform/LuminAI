import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Share2,
  GitBranch,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { apiFetch, getMockEntityById } from "../../lib/api";
import { EntityPropertyTable } from "../../features/explorer/components/EntityPropertyTable";
import { ProvenanceInspector } from "../../features/explorer/components/ProvenanceInspector";
import { EntityIcon } from "../../features/ontology/components/EntityTypeEditor";
import type { ProvenanceLine } from "../../features/explorer/components/EntityPropertyTable";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntityDetail {
  id: string;
  canonicalName: string;
  entityType: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

// ─── Ontology type config (mirrors ExplorerPage fallback) ─────────────────────

const TYPE_CONFIG: Record<
  string,
  { color: string; icon: string; label?: string }
> = {
  Person: { color: "#60a5fa", icon: "user" },
  Organization: { color: "#34d399", icon: "briefcase" },
  Dataset: { color: "#fb923c", icon: "database" },
  Device: { color: "#a78bfa", icon: "cpu" },
  Location: { color: "#f43f5e", icon: "map-pin" },
};

const DEFAULT_TYPE = { color: "#3b82f6", icon: "package", label: undefined };

// ─── Mock provenance stubs for EntityPropertyTable rendering ──────────────────
// ProvenanceInspector has the full detail; here we only need the confidence tier
// so the table can render the badge.

const MOCK_PROPERTY_PROVENANCE: Record<string, ProvenanceLine[]> = {
  e1: [
    { propertyKey: "email", sourceDataset: "users_gold_v2", sourceField: "user_email", ingestedAt: "2026-08-15T10:00:00Z", confidence: "high" },
    { propertyKey: "role", sourceDataset: "hr_export_2026_q2", sourceField: "job_title", ingestedAt: "2026-08-14T08:30:00Z", confidence: "high" },
    { propertyKey: "status", sourceDataset: "okta_directory_sync", sourceField: "account_status", ingestedAt: "2026-08-15T09:00:00Z", confidence: "high" },
    { propertyKey: "department", sourceDataset: "hr_export_2026_q2", sourceField: "cost_center_name", ingestedAt: "2026-08-14T08:30:00Z", confidence: "medium" },
  ],
  e2: [
    { propertyKey: "domain", sourceDataset: "clearbit_enrichment", sourceField: "company.domain", ingestedAt: "2026-08-12T09:00:00Z", confidence: "high" },
    { propertyKey: "industry", sourceDataset: "clearbit_enrichment", sourceField: "company.category.industry", ingestedAt: "2026-08-12T09:00:00Z", confidence: "medium" },
    { propertyKey: "location", sourceDataset: "clearbit_enrichment", sourceField: "company.geo.city", ingestedAt: "2026-08-12T09:00:00Z", confidence: "medium" },
    { propertyKey: "employees", sourceDataset: "linkedin_enrichment", sourceField: "employee_count", ingestedAt: "2026-08-10T12:00:00Z", confidence: "low" },
  ],
  e3: [
    { propertyKey: "size", sourceDataset: "s3_metadata_crawler", sourceField: "object_size_bytes", ingestedAt: "2026-08-19T23:40:00Z", confidence: "high" },
    { propertyKey: "rows", sourceDataset: "s3_metadata_crawler", sourceField: "row_count_estimate", ingestedAt: "2026-08-19T23:40:00Z", confidence: "medium" },
  ],
  e9: [
    { propertyKey: "ip", sourceDataset: "aws_ec2_inventory", sourceField: "private_ip_address", ingestedAt: "2026-08-01T04:20:00Z", confidence: "high" },
    { propertyKey: "status", sourceDataset: "aws_cloudwatch_health", sourceField: "instance_state", ingestedAt: "2026-08-20T00:00:00Z", confidence: "high" },
  ],
};

// ─── EntityDetailPage ─────────────────────────────────────────────────────────

export const EntityDetailPage: React.FC = () => {
  const { entityId } = useParams({ strict: false }) as { entityId: string };
  const navigate = useNavigate();

  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProvenanceKey, setActiveProvenanceKey] = useState<string | null>(
    null,
  );

  // ── Fetch entity detail ────────────────────────────────────────────────────
  useEffect(() => {
    if (!entityId) return;

    const fetchEntity = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/v1/explorer/entities/${entityId}`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data: EntityDetail = await res.json();
        setEntity(data);
      } catch {
        // Fall back to mock data
        const mock = getMockEntityById(entityId);
        if (mock) {
          setEntity(mock);
        } else {
          setError(`Entity "${entityId}" could not be found.`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEntity();
  }, [entityId]);

  // ── Derived type config ────────────────────────────────────────────────────
  const typeConf = entity
    ? (TYPE_CONFIG[entity.entityType] ?? DEFAULT_TYPE)
    : DEFAULT_TYPE;

  const provenance = MOCK_PROPERTY_PROVENANCE[entityId] ?? [];

  // ── Handle "Explore Graph" navigation ────────────────────────────────────
  const handleExploreGraph = () => {
    void navigate({ to: `/graph`, search: { entityId } });
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 py-24 gap-4">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="text-xs text-zinc-500 font-medium">
          Loading entity details...
        </span>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !entity) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 py-20 gap-5">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold text-zinc-300 mb-1">
            Entity Not Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-xs">
            {error ?? "The requested entity could not be loaded."}
          </p>
        </div>
        <Link
          to="/explorer"
          className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-xl transition-all cursor-pointer"
        >
          Back to Explorer
        </Link>
      </div>
    );
  }

  const dateFormatted = new Date(entity.createdAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <>
      {/* ── Provenance Inspector Drawer ───────────────────────────────────── */}
      <ProvenanceInspector
        entityId={entityId}
        propertyKey={activeProvenanceKey}
        onClose={() => setActiveProvenanceKey(null)}
      />

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 select-none max-w-5xl">
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
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* Icon Badge */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 shrink-0"
              style={{
                backgroundColor: `${typeConf.color}15`,
                borderColor: `${typeConf.color}35`,
                color: typeConf.color,
              }}
            >
              <EntityIcon iconKey={typeConf.icon} size={22} />
            </div>

            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-bold text-zinc-100 leading-tight">
                {entity.canonicalName}
              </h1>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Entity type chip */}
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg border capitalize tracking-wide"
                  style={{
                    backgroundColor: `${typeConf.color}12`,
                    borderColor: `${typeConf.color}25`,
                    color: typeConf.color,
                  }}
                >
                  {entity.entityType}
                </span>

                {/* Created date */}
                <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Calendar className="w-3 h-3" />
                  <span>Added {dateFormatted}</span>
                </div>

                {/* Entity ID */}
                <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                  ID: {entity.id}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Explore Graph CTA */}
            <button
              id="explore-graph-btn"
              onClick={handleExploreGraph}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl border border-blue-500/50 hover:border-blue-400/60 transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Explore Graph</span>
            </button>
          </div>
        </div>

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
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-950/40 to-zinc-900/40 border border-blue-500/15 rounded-2xl px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-200 mb-1">
              Visualize entity connections
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Open this entity in the Knowledge Graph to explore its semantic
              relationships, neighbour links, and relationship degrees.
            </p>
          </div>
          <button
            id="explore-graph-banner-btn"
            onClick={handleExploreGraph}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold rounded-xl border border-blue-500/40 hover:border-blue-400/60 transition-all duration-200 cursor-pointer shrink-0 ml-4 hover:-translate-y-0.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Open in Graph</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default EntityDetailPage;
