import React from "react";
import { Sliders, Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../../stores/themeStore";

export const SystemCapabilitiesCard: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-xs transition-colors">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center">
          <Sliders className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text">
            System Architecture & Preferences
          </h3>
          <p className="text-xs text-text-secondary">
            Current runtime engine capabilities, color theme palette, and
            telemetry switches
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {/* Theme Selection Setting */}
        <div className="bg-surface-subtle p-4 rounded-lg border border-border">
          <span className="text-text-secondary font-medium block mb-2">
            Theme Palette
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex-1 py-1 px-2.5 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                theme === "light"
                  ? "bg-surface border-primary text-primary font-semibold shadow-xs"
                  : "bg-transparent border-transparent text-text-secondary hover:text-text hover:bg-surface/50"
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light (Default)</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex-1 py-1 px-2.5 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                theme === "dark"
                  ? "bg-surface border-primary text-primary font-semibold shadow-xs"
                  : "bg-transparent border-transparent text-text-secondary hover:text-text hover:bg-surface/50"
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        <div className="bg-surface-subtle p-4 rounded-lg border border-border">
          <span className="text-text-secondary font-medium block mb-1">
            Cache Layer
          </span>
          <span className="text-text font-semibold">
            Redis (30s Dashboard / 60s Explorer)
          </span>
        </div>

        <div className="bg-surface-subtle p-4 rounded-lg border border-border">
          <span className="text-text-secondary font-medium block mb-1">
            Event Bus
          </span>
          <span className="text-text font-semibold">
            Apache Kafka (Batch 100)
          </span>
        </div>
      </div>
    </div>
  );
};
