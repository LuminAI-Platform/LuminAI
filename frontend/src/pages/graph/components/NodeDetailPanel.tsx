import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Network,
  ExternalLink,
  GitFork,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
} from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import type { GraphNodeData } from "./GraphCanvas";

interface NodeStats {
  entityId: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  clusterCoefficient: number;
  relationshipTypeCounts: Record<string, number>;
}

interface NodeDetailPanelProps {
  node: GraphNodeData | null;
  onClose: () => void;
  onExpand: (nodeId: string) => void;
}

/**
 * Slide-out inspector panel detailing entity attributes, graph centrality, and lineage.
 * Styled exclusively with design system tokens for light and dark themes.
 */
export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  onClose,
  onExpand,
}) => {
  const isDark = useThemeStore((s) => s.isDark);

  const { data: stats, isLoading: isStatsLoading } = useQuery<NodeStats | null>(
    {
      queryKey: ["graph", "stats", node?.id],
      queryFn: async () => {
        if (!node) return null;
        try {
          const res = await apiFetch(
            `/api/v1/graph/stats?entityId=${encodeURIComponent(node.id)}`,
            { headers: { "X-Suppress-Toast": "true" } },
          );
          return res.json();
        } catch {
          return null;
        }
      },
      enabled: Boolean(node),
      retry: false,
    },
  );

  if (!node) return null;

  const nodeColor = node.color || getEntityColor(node.entityType, isDark);

  return (
    <aside
      aria-label="Entity details"
      className="absolute top-4 right-4 z-20 w-80 bg-surface/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-5 flex flex-col gap-4 max-h-[calc(100%-2rem)] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: nodeColor }}
              aria-hidden="true"
            />
            <Badge variant="default" className="text-[10px]">
              {node.entityType || "Entity"}
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-text truncate">
            {node.label || node.id}
          </h3>
          <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate">
            {node.id}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close entity details"
          className="text-text-secondary hover:text-text hover:bg-surface-hover p-1 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Degree & Topology Metrics */}
      <div>
        <h4 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
          <Network
            className="w-3.5 h-3.5 text-text-secondary"
            aria-hidden="true"
          />
          Graph Centrality
        </h4>
        {isStatsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface-subtle p-2.5 rounded-lg border border-border">
              <span className="text-[10px] text-text-secondary block mb-0.5">
                Degree
              </span>
              <span className="text-sm font-bold text-text">
                {stats?.degree ?? 0}
              </span>
            </div>
            <div className="bg-surface-subtle p-2.5 rounded-lg border border-border">
              <span className="text-[10px] text-text-secondary block mb-0.5 flex items-center justify-center gap-0.5">
                <ArrowDownLeft
                  className="w-2.5 h-2.5 text-text-secondary"
                  aria-hidden="true"
                />{" "}
                In
              </span>
              <span className="text-sm font-bold text-text">
                {stats?.inDegree ?? 0}
              </span>
            </div>
            <div className="bg-surface-subtle p-2.5 rounded-lg border border-border">
              <span className="text-[10px] text-text-secondary block mb-0.5 flex items-center justify-center gap-0.5">
                <ArrowUpRight
                  className="w-2.5 h-2.5 text-text-secondary"
                  aria-hidden="true"
                />{" "}
                Out
              </span>
              <span className="text-sm font-bold text-text">
                {stats?.outDegree ?? 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Relationship types breakdown */}
      {stats?.relationshipTypeCounts &&
        Object.keys(stats.relationshipTypeCounts).length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
              <GitFork
                className="w-3.5 h-3.5 text-text-secondary"
                aria-hidden="true"
              />
              Adjacent Edges
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.relationshipTypeCounts).map(
                ([type, count]) => (
                  <span
                    key={type}
                    className="px-2 py-0.5 rounded-md text-[10px] bg-surface-subtle border border-border text-text flex items-center gap-1"
                  >
                    <span>{type}</span>
                    <span className="font-bold text-text-secondary">
                      &times;{count}
                    </span>
                  </span>
                ),
              )}
            </div>
          </div>
        )}

      {/* Entity Properties Table */}
      {node.properties && Object.keys(node.properties).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary mb-2">
            Properties
          </h4>
          <div className="bg-surface-subtle rounded-lg border border-border p-2.5 divide-y divide-border-subtle text-xs">
            {Object.entries(node.properties).map(([k, v]) => (
              <div key={k} className="py-1.5 flex justify-between gap-2">
                <span className="text-text-muted font-mono text-[10px] truncate">
                  {k}
                </span>
                <span className="text-text text-right truncate max-w-[140px]">
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onExpand(node.id)}
          leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          Expand Node (1 Hop)
        </Button>

        <Link to="/explorer/$entityId" params={{ entityId: node.id }}>
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Open in Entity Detail
          </Button>
        </Link>
      </div>
    </aside>
  );
};
