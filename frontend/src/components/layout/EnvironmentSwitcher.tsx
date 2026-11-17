import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, AlertTriangle } from "lucide-react";
import {
  useEnvironmentStore,
  ENVIRONMENT_CONFIGS,
  type AppEnvironment,
} from "../../stores/environmentStore";

interface EnvironmentSwitcherProps {
  environmentOverride?: AppEnvironment;
}

export const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({
  environmentOverride,
}) => {
  const storeEnv = useEnvironmentStore((s) => s.environment);
  const storeConfig = useEnvironmentStore((s) => s.config);
  const setEnvironment = useEnvironmentStore((s) => s.setEnvironment);

  const environment = environmentOverride ?? storeEnv;
  const config = environmentOverride
    ? ENVIRONMENT_CONFIGS[environmentOverride]
    : storeConfig;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (env: AppEnvironment) => {
    setEnvironment(env);
    setIsOpen(false);
  };

  const envOptions: AppEnvironment[] = ["production", "staging", "development"];

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Switcher Trigger Button */}
      <button
        type="button"
        id="environment-switcher-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-primary ${
          config.isProduction
            ? "bg-error-bg/60 hover:bg-error-bg border-error-border text-error shadow-xs"
            : "bg-surface-subtle hover:bg-surface-muted border-border text-text"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current environment: ${config.label}. Click to switch.`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`}
          />
          <span className="hidden sm:inline font-semibold">{config.label}</span>
          <span className="sm:hidden font-semibold">{config.shortLabel}</span>
        </span>

        {config.isProduction && (
          <span className="hidden md:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-error text-text-contrast shrink-0">
            LIVE
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Switcher Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Environments"
          className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-lg p-1.5 z-50 animate-in fade-in duration-100"
        >
          <div className="px-3 py-2 border-b border-border mb-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text">
                Environment
              </span>
              <span className="text-[10px] text-text-secondary font-mono">
                Active target
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Select execution environment for pipelines and data sources.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            {envOptions.map((envKey) => {
              const optionConfig = ENVIRONMENT_CONFIGS[envKey];
              const isSelected = environment === envKey;

              return (
                <button
                  key={envKey}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(envKey)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-start justify-between gap-2.5 border ${
                    isSelected
                      ? optionConfig.isProduction
                        ? "bg-error-bg/70 border-error-border text-error"
                        : "bg-surface-subtle border-border text-text font-medium"
                      : "border-transparent hover:bg-surface-subtle text-text"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full mt-1 shrink-0 ${optionConfig.dotClass}`}
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-semibold ${
                            optionConfig.isProduction
                              ? "text-error"
                              : "text-text"
                          }`}
                        >
                          {optionConfig.label}
                        </span>
                        {optionConfig.isProduction && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-error-bg text-error border border-error-border">
                            Prod
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-secondary truncate mt-0.5">
                        {optionConfig.description}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        optionConfig.isProduction
                          ? "text-error"
                          : "text-primary"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Warning Banner for Production */}
          {environment === "production" && (
            <div className="mt-1.5 pt-2 border-t border-border px-2 pb-1">
              <div className="flex items-start gap-2 p-2 rounded-md bg-warning-bg/60 border border-warning-border text-[11px] text-warning leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Prod actions execute directly against live datasets and
                  production connections.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
