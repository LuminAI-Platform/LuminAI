import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, Network, ExternalLink, GitFork, ArrowDownLeft, ArrowUpRight, PlusCircle } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
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
 * Slide-out inspector panel detailing entity attributes, graph centrality, and lineage
 */
export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  onClose,
  onExpand,
}) => {
  const { data: stats, isLoading: isStatsLoading } = useQuery<NodeStats>({
    queryKey: ["graph", "stats", node?.id],
    queryFn: async () => {
      if (!node) return null;
      const res = await apiFetch(`/api/v1/graph/stats?entityId=${encodeURIComponent(node.id)}`);
      return res.json();
    },
    enabled: !!node,
  });

  if (!node) return null;

  return (
    <div className="absolute top-4 right-4 z-20 w-84 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 max-h-[calc(100%-2rem)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: node.color || "#3b82f6" }}
            />
            <Badge variant="default" className="text-[10px]">
              {node.entityType || "Entity"}
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-zinc-100 truncate">
            {node.label || node.id}
          </h3>
          <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
            {node.id}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Degree & Topology Metrics */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-blue-400" />
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
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 block mb-0.5">Degree</span>
              <span className="text-sm font-bold text-zinc-200">
                {stats?.degree ?? 0}
              </span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 block mb-0.5 flex items-center justify-center gap-0.5">
                <ArrowDownLeft className="w-2.5 h-2.5 text-emerald-400" /> In
              </span>
              <span className="text-sm font-bold text-zinc-200">
                {stats?.inDegree ?? 0}
              </span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 block mb-0.5 flex items-center justify-center gap-0.5">
                <ArrowUpRight className="w-2.5 h-2.5 text-blue-400" /> Out
              </span>
              <span className="text-sm font-bold text-zinc-200">
                {stats?.outDegree ?? 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Relationship types breakdown */}
      {stats?.relationshipTypeCounts && Object.keys(stats.relationshipTypeCounts).length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <GitFork className="w-3.5 h-3.5 text-purple-400" />
            Adjacent Edges
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.relationshipTypeCounts).map(([type, count]) => (
              <span
                key={type}
                className="px-2 py-0.5 rounded-md text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-1"
              >
                <span>{type}</span>
                <span className="font-bold text-blue-400">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Entity Properties Table */}
      {node.properties && Object.keys(node.properties).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 mb-2">Properties</h4>
          <div className="bg-zinc-950 rounded-lg border border-zinc-800/80 p-2.5 divide-y divide-zinc-900 text-xs">
            {Object.entries(node.properties).map(([k, v]) => (
              <div key={k} className="py-1.5 flex justify-between gap-2">
                <span className="text-zinc-500 font-mono text-[10px] truncate">{k}</span>
                <span className="text-zinc-300 text-right truncate max-w-[140px]">
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onExpand(node.id)}
          leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          Expand Node (1 Hop)
        </Button>

        <Link to="/explorer/entity/$entityId" params={{ entityId: node.id }}>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-zinc-400 hover:text-zinc-200"
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Open in Entity Detail
          </Button>
        </Link>
      </div>
    </div>
  );
};
