import React from "react";
import { Sliders } from "lucide-react";
import { SYSTEM_CAPABILITIES } from "../constants";

export const SystemCapabilitiesCard: React.FC = () => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-800/80">
        <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center justify-center">
          <Sliders className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            System Architecture & Preferences
          </h3>
          <p className="text-xs text-zinc-400">
            Current runtime engine capabilities and telemetry switches
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {SYSTEM_CAPABILITIES.map((cap) => (
          <div
            key={cap.label}
            className="bg-zinc-950 p-4 rounded-lg border border-zinc-800/80"
          >
            <span className="text-zinc-500 font-medium block mb-1">
              {cap.label}
            </span>
            <span className="text-zinc-200 font-semibold">{cap.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
