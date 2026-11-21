import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "../../../../lib/icons";
import { PipelineJobCard, type PipelineJob } from "../PipelineJobCard";
import type { FilterStatus } from "./pipelineMonitorUtils";

interface PipelineJobsListProps {
  jobs: PipelineJob[];
  filter: FilterStatus;
  onSelectRun: (job: PipelineJob, triggerEl: HTMLElement | null) => void;
}

export const PipelineJobsList: React.FC<PipelineJobsListProps> = ({
  jobs,
  filter,
  onSelectRun,
}) => {
  if (jobs.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-12 text-center text-xs text-text-secondary">
        {filter === "ALL" ? (
          <div className="flex flex-col items-center gap-3">
            <span className="font-semibold text-text">
              No pipeline runs yet
            </span>
            <p className="text-text-secondary">
              Connect a data source to begin running pipelines and observing
              live execution telemetry.
            </p>
            <Link
              to="/connections"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text font-semibold text-xs shadow-xs"
            >
              <span>Create a connection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          `No runs matching "${filter}"`
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {jobs.map((job) => (
        <PipelineJobCard key={job.id} job={job} onSelectRun={onSelectRun} />
      ))}
    </div>
  );
};
