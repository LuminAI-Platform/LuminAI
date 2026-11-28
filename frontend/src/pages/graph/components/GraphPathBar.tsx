import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, GitFork, Loader2, X } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import type { GraphNodeData } from "./GraphCanvas";
import { mapExplorerItemsToSuggestions } from "../graphDataUtils";
import type { SuggestedEntity } from "../useGraphData";

interface GraphPathBarProps {
  isOpen: boolean;
  prefillSource?: { id: string; label?: string } | null;
  canvasNodes: Array<{ data: GraphNodeData }>;
  isFinding: boolean;
  pathResult: {
    sourceId: string;
    targetId: string;
    nodeCount: number;
    edgeCount: number;
  } | null;
  pathError: string | null;
  onFindPath: (sourceId: string, targetId: string) => Promise<unknown>;
  onClearPath: () => void;
  onClose: () => void;
}

interface EndpointValue {
  id: string;
  display: string;
}

interface PathEndpointInputProps {
  label: string;
  placeholder: string;
  value: EndpointValue;
  onChange: (next: EndpointValue) => void;
  canvasNodes: Array<{ data: GraphNodeData }>;
}

const PathEndpointInput: React.FC<PathEndpointInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  canvasNodes,
}) => {
  const [open, setOpen] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<SuggestedEntity[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    const trimmed = value.display.trim();
    if (trimmed.length < 2) {
      setRemoteOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/v1/explorer/search?query=${encodeURIComponent(trimmed)}&size=5`,
          {
            headers: { "X-Suppress-Toast": "true" },
            signal: controller.signal,
          },
        );
        const data = await res.json();
        const { items } = mapExplorerItemsToSuggestions(data, 5);
        setRemoteOptions(items);
      } catch {
        if (!controller.signal.aborted) {
          setRemoteOptions([]);
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value.display]);

  const needle = value.display.trim().toLowerCase();
  const localMatches: SuggestedEntity[] = canvasNodes
    .filter((n) => {
      if (!needle) return true;
      const lbl = (n.data.label || "").toLowerCase();
      return lbl.includes(needle) || n.data.id.toLowerCase().includes(needle);
    })
    .slice(0, 5)
    .map((n) => ({
      id: n.data.id,
      canonicalName: n.data.label || n.data.id,
      entityType: n.data.entityType || "Entity",
    }));

  const mergedOptions = [...localMatches];
  for (const item of remoteOptions) {
    if (!mergedOptions.some((o) => o.id === item.id)) {
      mergedOptions.push(item);
    }
  }

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-[200px]">
      <label className="sr-only">{label}</label>
      <input
        type="text"
        value={value.display}
        aria-label={label}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange({ id: e.target.value, display: e.target.value });
          setOpen(true);
        }}
        className="w-full bg-surface text-text placeholder:text-text-secondary text-xs px-3 py-1.5 rounded-lg border border-border focus:border-border-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      {open && mergedOptions.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 z-30 rounded-lg border border-border bg-surface p-1 shadow-lg max-h-48 overflow-y-auto">
          {mergedOptions.slice(0, 7).map((opt) => (
            <li
              key={opt.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ id: opt.id, display: opt.canonicalName });
                setOpen(false);
              }}
              className="px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 text-text hover:bg-surface-hover cursor-pointer"
            >
              <span className="truncate font-medium">{opt.canonicalName}</span>
              <span className="text-[10px] text-text-secondary shrink-0">
                {opt.entityType}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const GraphPathBar: React.FC<GraphPathBarProps> = ({
  isOpen,
  prefillSource,
  canvasNodes,
  isFinding,
  pathResult,
  pathError,
  onFindPath,
  onClearPath,
  onClose,
}) => {
  const [source, setSource] = useState<EndpointValue>({
    id: "",
    display: "",
  });
  const [target, setTarget] = useState<EndpointValue>({
    id: "",
    display: "",
  });

  useEffect(() => {
    if (prefillSource?.id) {
      setSource({
        id: prefillSource.id,
        display: prefillSource.label || prefillSource.id,
      });
    }
  }, [prefillSource]);

  if (!isOpen && !pathResult) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFindPath(source.id || source.display, target.id || target.display);
  };

  return (
    <div
      className="bg-surface border border-border rounded-lg px-3.5 py-2.5 flex flex-wrap items-center gap-2.5 shadow-xs"
      role="region"
      aria-label="Shortest path finder"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text shrink-0">
        <GitFork className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span>Shortest Path</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]"
      >
        <PathEndpointInput
          label="Source entity"
          placeholder="Source entity name or ID"
          value={source}
          onChange={setSource}
          canvasNodes={canvasNodes}
        />
        <ArrowRight
          className="w-3.5 h-3.5 text-text-secondary shrink-0"
          aria-hidden="true"
        />
        <PathEndpointInput
          label="Target entity"
          placeholder="Target entity name or ID"
          value={target}
          onChange={setTarget}
          canvasNodes={canvasNodes}
        />

        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={
            isFinding || !source.display.trim() || !target.display.trim()
          }
          leftIcon={
            isFinding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : undefined
          }
        >
          {isFinding ? "Finding..." : "Find Path"}
        </Button>
      </form>

      {pathResult && (
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-medium">
            {pathResult.nodeCount} nodes &middot; {pathResult.edgeCount}{" "}
            {pathResult.edgeCount === 1 ? "hop" : "hops"}
          </span>
          <Button size="sm" variant="ghost" onClick={onClearPath}>
            Exit Path
          </Button>
        </div>
      )}

      {pathError && (
        <span className="text-xs text-error font-medium">{pathError}</span>
      )}

      <button
        type="button"
        onClick={() => {
          onClearPath();
          onClose();
        }}
        aria-label="Close shortest path finder"
        className="p-1 text-text-secondary hover:text-text hover:bg-surface-hover rounded-md transition-colors cursor-pointer ml-auto"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};
