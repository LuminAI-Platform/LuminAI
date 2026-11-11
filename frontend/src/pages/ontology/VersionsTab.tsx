import React from "react";
import type { OntologyVersion } from "./useOntologyData";

interface VersionsTabProps {
  versions: OntologyVersion[];
}

export const VersionsTab: React.FC<VersionsTabProps> = ({ versions }) => {
  return (
    <div className="flex flex-col gap-4">
      {versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-lg bg-zinc-950/40">
          <div className="text-zinc-600 mb-3">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-400">
            No versions published yet
          </span>
          <span className="text-xs text-zinc-600 mt-1 mb-4">
            Click "Publish Version" to snapshot the current ontology schema
          </span>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/40">
          <div className="overflow-x-auto min-w-0">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-12 bg-zinc-900/60 px-5 py-3 border-b border-zinc-800/80 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                <div className="col-span-3">Version</div>
                <div className="col-span-4">Published At</div>
                <div className="col-span-3">Published By</div>
                <div className="col-span-2">Status</div>
              </div>
              <div className="divide-y divide-zinc-900">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-12 px-5 py-3.5 items-center text-xs hover:bg-zinc-900/30 transition-all"
                  >
                    <div className="col-span-3 font-bold font-mono text-zinc-200">
                      {v.version}
                    </div>
                    <div className="col-span-4 text-zinc-500">
                      {v.publishedAt}
                    </div>
                    <div className="col-span-3 text-zinc-400">
                      {v.publishedBy}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          v.status === "PUBLISHED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : v.status === "DEPRECATED"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-zinc-800 text-zinc-500 border-zinc-700"
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
