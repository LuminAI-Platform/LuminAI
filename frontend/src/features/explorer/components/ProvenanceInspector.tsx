import React, { useEffect, useState } from "react";
import {
  X,
  Database,
  Clock,
  Tag,
  GitBranch,
  Info,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import type { ProvenanceLine } from "./EntityPropertyTable";

interface ProvenanceInspectorProps {
  entityId: string;
  propertyKey: string | null; // null = drawer closed
  onClose: () => void;
}

const CONFIDENCE_CONFIG = {
  high: {
    label: "High Confidence",
    badgeCls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    dotCls: "bg-emerald-400",
  },
  medium: {
    label: "Medium Confidence",
    badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    dotCls: "bg-amber-400",
  },
  low: {
    label: "Low Confidence",
    badgeCls: "bg-red-500/10 text-red-400 border-red-500/25",
    dotCls: "bg-red-400",
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ProvenanceInspector: React.FC<ProvenanceInspectorProps> = ({
  entityId,
  propertyKey,
  onClose,
}) => {
  const isOpen = propertyKey !== null;
  const [provenanceLines, setProvenanceLines] = useState<ProvenanceLine[]>([]);
  const [loading, setLoading] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Fetch real provenance from backend
  useEffect(() => {
    if (!isOpen || !entityId) return;

    let isMounted = true;
    const fetchProvenance = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(
          `/api/v1/explorer/entities/${entityId}/provenance`,
        );
        if (res.ok) {
          const data: ProvenanceLine[] = await res.json();
          if (isMounted) {
            setProvenanceLines(Array.isArray(data) ? data : []);
          }
        } else {
          if (isMounted) setProvenanceLines([]);
        }
      } catch {
        if (isMounted) setProvenanceLines([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProvenance();
    return () => {
      isMounted = false;
    };
  }, [isOpen, entityId]);

  const lines: ProvenanceLine[] = propertyKey
    ? provenanceLines.filter((l) => l.propertyKey === propertyKey)
    : provenanceLines;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Property Provenance Inspector"
        className={`fixed top-0 right-0 h-full z-50 w-full max-w-md bg-zinc-950 border-l border-zinc-800/80 shadow-2xl shadow-black/80 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                Provenance Lineage
              </h2>
              {propertyKey && (
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  property: <span className="text-blue-400">{propertyKey}</span>
                </p>
              )}
            </div>
          </div>
          <button
            id="provenance-inspector-close"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
            aria-label="Close provenance inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
              <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-xs text-zinc-500">
                Loading provenance...
              </span>
            </div>
          ) : lines.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Info className="w-5 h-5 text-zinc-600" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-1.5">
                No Lineage Available
              </h3>
              <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
                No source dataset records were found for{" "}
                <span className="font-mono text-zinc-500">
                  {propertyKey ?? "this property"}
                </span>
                . The value may have been set manually or via a direct API
                write.
              </p>
            </div>
          ) : (
            <>
              {/* Section label */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {lines.length} source{lines.length > 1 ? "s" : ""} found
                </span>
                <div className="flex-1 h-px bg-zinc-900" />
              </div>

              {/* Provenance cards */}
              <div className="flex flex-col gap-4">
                {lines.map((line, idx) => {
                  const conf = CONFIDENCE_CONFIG[line.confidence];
                  return (
                    <div
                      key={`${line.sourceDataset}-${idx}`}
                      className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-4 hover:border-zinc-700/80 transition-colors"
                    >
                      {/* Source name + confidence */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center shrink-0">
                            <Database className="w-3.5 h-3.5 text-zinc-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-200 font-mono truncate">
                              {line.sourceDataset}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              Source dataset
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-2 py-1 rounded-lg border shrink-0 flex items-center gap-1.5 ${conf.badgeCls}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${conf.dotCls}`}
                          />
                          {conf.label}
                        </span>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl px-3 py-2">
                          <Tag className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-0.5">
                              Source Field
                            </p>
                            <p className="text-xs font-mono text-zinc-300 truncate">
                              {line.sourceField}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl px-3 py-2">
                          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mb-0.5">
                              Ingested At
                            </p>
                            <p className="text-xs text-zinc-300 truncate">
                              {formatDateTime(line.ingestedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer note */}
              <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/15 rounded-xl p-3.5">
                <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Provenance data reflects the last known ingestion snapshot.
                  Values may have since been updated by a more recent pipeline
                  run.
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
