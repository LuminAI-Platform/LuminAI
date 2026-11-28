import React, { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch } from "../../../lib/icons";
import type {
  Dataset,
  LineageGraph,
  LineageNode,
} from "../../../features/datasets/types";

interface DatasetLineageTabProps {
  dataset: Dataset;
  lineage?: LineageGraph;
  datasetId: string;
}

function collectHopNodes(
  startId: string,
  edges: LineageGraph["edges"],
  direction: "upstream" | "downstream",
): Map<string, { depth: number; transformType: string }> {
  const result = new Map<string, { depth: number; transformType: string }>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: startId, depth: 0 },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const edge of edges) {
      const nextId =
        direction === "upstream"
          ? edge.target === curr.id
            ? edge.source
            : null
          : edge.source === curr.id
            ? edge.target
            : null;
      if (nextId && !visited.has(nextId)) {
        visited.add(nextId);
        const depth = curr.depth + 1;
        result.set(nextId, {
          depth,
          transformType: edge.transformationType || "TRANSFORM",
        });
        queue.push({ id: nextId, depth });
      }
    }
  }
  return result;
}

export const DatasetLineageTab: React.FC<DatasetLineageTabProps> = ({
  dataset,
  lineage,
  datasetId,
}) => {
  const { upstreamColumns, downstreamColumns } = useMemo(() => {
    const nodes = lineage?.nodes ?? [];
    const edges = lineage?.edges ?? [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const upMap = collectHopNodes(datasetId, edges, "upstream");
    const downMap = collectHopNodes(datasetId, edges, "downstream");

    const groupByDepth = (
      hopMap: Map<string, { depth: number; transformType: string }>,
      reverseOrder: boolean,
    ) => {
      const levels = new Map<
        number,
        Array<{ node: LineageNode; transformType: string }>
      >();
      for (const [id, info] of hopMap.entries()) {
        const node = nodeMap.get(id) ?? {
          id,
          label: id.slice(0, 8),
          type: "DATASET",
        };
        const arr = levels.get(info.depth) ?? [];
        arr.push({ node, transformType: info.transformType });
        levels.set(info.depth, arr);
      }
      const sortedKeys = Array.from(levels.keys()).sort((a, b) =>
        reverseOrder ? b - a : a - b,
      );
      return sortedKeys.map((depth) => ({
        depth,
        items: levels.get(depth)!,
      }));
    };

    return {
      upstreamColumns: groupByDepth(upMap, true),
      downstreamColumns: groupByDepth(downMap, false),
    };
  }, [lineage, datasetId]);

  return (
    <div className="p-6 rounded-xl border border-border bg-surface flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-text">
            Multi-Hop Dataset Lineage DAG
          </h3>
        </div>
        {lineage && (
          <span className="text-xs text-text-secondary font-mono">
            {lineage.nodes.length} nodes • {lineage.edges.length} edges
          </span>
        )}
      </div>

      <div className="p-6 border border-dashed border-border rounded-lg bg-surface-subtle/50 overflow-x-auto">
        <div className="flex items-center justify-center gap-4 min-w-max">
          {upstreamColumns.length === 0 ? (
            <div className="p-3 rounded-lg border border-border bg-surface text-center min-w-[150px]">
              <span className="text-[11px] text-text-secondary block">
                Upstream Sources
              </span>
              <span className="text-xs font-medium text-text-secondary">
                Root / No parents
              </span>
            </div>
          ) : (
            upstreamColumns.map((lvl) => (
              <React.Fragment key={`up-${lvl.depth}`}>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase text-text-secondary text-center">
                    Upstream -{lvl.depth}
                  </span>
                  {lvl.items.map(({ node, transformType }) => (
                    <Link
                      key={node.id}
                      to="/datasets/$datasetId"
                      params={{ datasetId: node.id }}
                      className="p-3 rounded-lg border border-border bg-surface hover:border-primary/60 transition-colors min-w-[160px] block"
                    >
                      <span className="text-[10px] font-mono text-text-secondary block">
                        {node.layer || "DATASET"} • {transformType}
                      </span>
                      <span className="text-xs font-semibold text-text block truncate max-w-[180px]">
                        {node.label}
                      </span>
                    </Link>
                  ))}
                </div>
                <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />
              </React.Fragment>
            ))
          )}

          {upstreamColumns.length === 0 && (
            <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />
          )}

          <div className="p-4 rounded-xl border-2 border-primary bg-primary/10 text-center min-w-[180px]">
            <span className="text-[10px] font-mono text-primary font-bold uppercase block">
              {dataset.layer} • Selected
            </span>
            <span className="text-sm font-bold text-text block">
              {dataset.displayName || dataset.name}
            </span>
            <span className="text-[11px] text-text-secondary font-mono">
              {(dataset.rowCount || 0).toLocaleString()} rows
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />

          {downstreamColumns.length === 0 ? (
            <div className="p-3 rounded-lg border border-border bg-surface text-center min-w-[150px]">
              <span className="text-[11px] text-text-secondary block">
                Downstream Targets
              </span>
              <span className="text-xs font-medium text-text-secondary">
                Leaf dataset
              </span>
            </div>
          ) : (
            downstreamColumns.map((lvl, idx) => (
              <React.Fragment key={`down-${lvl.depth}`}>
                {idx > 0 && (
                  <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />
                )}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono uppercase text-text-secondary text-center">
                    Downstream +{lvl.depth}
                  </span>
                  {lvl.items.map(({ node, transformType }) => (
                    <Link
                      key={node.id}
                      to="/datasets/$datasetId"
                      params={{ datasetId: node.id }}
                      className="p-3 rounded-lg border border-border bg-surface hover:border-primary/60 transition-colors min-w-[160px] block"
                    >
                      <span className="text-[10px] font-mono text-text-secondary block">
                        {node.layer || "DATASET"} • {transformType}
                      </span>
                      <span className="text-xs font-semibold text-text block truncate max-w-[180px]">
                        {node.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
