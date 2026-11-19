import React from "react";

interface WizardStepperProps {
  step: 1 | 2 | 3 | 4;
}

const WIZARD_STEPS = [
  { s: 1, name: "Upload File" },
  { s: 2, name: "Define Types & Mapping" },
  { s: 3, name: "Preview Data" },
  { s: 4, name: "Ingestion Summary" },
] as const;

export const WizardStepper: React.FC<WizardStepperProps> = ({ step }) => {
  return (
    <div className="shrink-0 overflow-visible border-b border-border bg-surface px-4 sm:px-6 pt-4 pb-3.5 select-none text-xs font-semibold">
      <div className="w-full max-w-[800px] mx-auto my-0.5 flex items-center justify-between gap-2">
        {WIZARD_STEPS.map((item, idx) => (
          <React.Fragment key={item.s}>
            <div className="flex items-center gap-2 min-w-0 py-0.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs font-medium shrink-0 transition-all ${
                  step === item.s
                    ? "bg-primary border-primary text-primary-text"
                    : step > item.s
                      ? "bg-success-bg border-success-border text-success"
                      : "bg-surface-subtle border-border text-text-secondary"
                }`}
              >
                {item.s}
              </span>
              <span
                className={`whitespace-nowrap leading-normal hidden lg:inline ${
                  step === item.s
                    ? "text-text font-semibold"
                    : "text-text-secondary"
                }`}
              >
                {item.name}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <span className="text-text-muted/40 mx-1 sm:mx-2 font-normal select-none shrink-0">
                ➔
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
