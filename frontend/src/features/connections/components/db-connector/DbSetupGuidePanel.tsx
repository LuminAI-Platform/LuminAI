import React from "react";
import { BrandLoader } from "../../../../components/ui/BrandLoader";

const GUIDE_STEPS = [
  {
    step: 1,
    title: "Enter details",
    description:
      "Provide host, port, database name, and a read-only user account.",
  },
  {
    step: 2,
    title: "Test connection",
    description:
      "Verify network reachability and credentials before importing.",
  },
  {
    step: 3,
    title: "Choose tables",
    description: "Select which schemas and tables to register for sync.",
  },
];

interface DbSetupGuidePanelProps {
  isBusy: boolean;
  host: string;
  currentGuideStep: number;
}

export const DbSetupGuidePanel: React.FC<DbSetupGuidePanelProps> = ({
  isBusy,
  host,
  currentGuideStep,
}) => {
  return (
    <div className="bg-surface-subtle/40 border border-border rounded-lg p-5 space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-text">How setup works</h3>
        <p className="text-xs text-text-secondary mt-0.5">
          Follow these three steps to connect and start syncing.
        </p>
      </div>

      {isBusy && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-lg bg-primary-tint border border-primary-border flex items-center gap-3"
        >
          <BrandLoader variant="inline" size={18} />
          <span className="text-xs font-medium text-primary truncate">
            Connecting to {host.trim() || "database"}...
          </span>
        </div>
      )}

      <ol className="space-y-3">
        {GUIDE_STEPS.map((item) => {
          const isCurrent = currentGuideStep === item.step;
          const isDone = currentGuideStep > item.step;
          return (
            <li
              key={item.step}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                isCurrent
                  ? "bg-surface border-primary-border shadow-xs"
                  : isDone
                    ? "bg-success-bg/50 border-success-border"
                    : "bg-surface/60 border-border"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
                  isCurrent
                    ? "bg-primary text-primary-text"
                    : isDone
                      ? "bg-success text-primary-text"
                      : "bg-surface-subtle border border-border text-text-secondary"
                }`}
              >
                {item.step}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text">{item.title}</p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
