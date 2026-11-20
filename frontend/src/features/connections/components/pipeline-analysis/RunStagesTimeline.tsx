import React from "react";
import { Layers } from "../../../../lib/icons";

interface RunStagesTimelineProps {
  isFailed: boolean;
  failedStep: string | null;
}

const STAGES_LIST = [
  { key: "ingest", name: "Data Ingest" },
  { key: "clean", name: "Data Cleaning" },
  { key: "dedupe", name: "Deduplication" },
  { key: "resolve", name: "Entity Resolution" },
];

export const RunStagesTimeline: React.FC<RunStagesTimelineProps> = ({
  isFailed,
  failedStep,
}) => {
  return (
    <div className="bg-surface-subtle border border-border rounded-xl p-4">
      <h4 className="text-xs font-bold text-text mb-3 flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span>Pipeline Stage Execution Timeline</span>
      </h4>
      <div className="space-y-2">
        {STAGES_LIST.map((st, idx) => {
          const isStepFailed =
            isFailed &&
            (failedStep === st.key ||
              (!failedStep && idx === STAGES_LIST.length - 1));
          const isCompleted =
            !isFailed ||
            STAGES_LIST.findIndex((s) => s.key === failedStep) > idx;

          return (
            <div
              key={st.key}
              className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isStepFailed
                      ? "bg-error"
                      : isCompleted
                        ? "bg-success"
                        : "bg-nodata"
                  }`}
                />
                <span className="font-medium text-text">{st.name}</span>
              </div>

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isStepFailed
                    ? "bg-error-bg text-error border-error-border"
                    : isCompleted
                      ? "bg-success-bg text-success border-success-border"
                      : "bg-surface-subtle text-text-secondary border-border"
                }`}
              >
                {isStepFailed ? "Failed" : isCompleted ? "Completed" : "Queued"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
