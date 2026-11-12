import React from "react";
import { type SchemaMappingPayload } from "./visualSchemaTypes";

interface PayloadPreviewProps {
  currentPayload: SchemaMappingPayload;
  mappedCount: number;
  fkCount: number;
}

export const PayloadPreview: React.FC<PayloadPreviewProps> = ({
  currentPayload,
  mappedCount,
  fkCount,
}) => {
  return (
    <div className="px-6 py-3 border-b border-zinc-800/80 bg-black/60 flex-shrink-0 animate-in fade-in duration-150">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          API Payload Config
        </p>
        <span className="text-[10px] text-zinc-400">
          {mappedCount} mapped · {fkCount} graph{" "}
          {fkCount === 1 ? "link" : "links"}
        </span>
      </div>
      <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-36">
        {JSON.stringify(currentPayload, null, 2)}
      </pre>
    </div>
  );
};
