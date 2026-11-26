import React from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Dialog } from "../../../components/ui/Dialog";
import { Database, Upload, ArrowRight, ICON_SIZES } from "../../../lib/icons";
import { useConnectionModalStore } from "../../../stores/connectionModalStore";

/**
 * Unified "New connection" chooser dialog opened from the top bar or the
 * All sources header button. Lists only source types supported by the backend API
 * (Databases and File upload — object storage is not yet supported by the API).
 */
export const NewConnectionChooserModal: React.FC = () => {
  const { chooserOpen, closeChooser, requestAction } =
    useConnectionModalStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleChoose = (action: "new-db" | "upload") => {
    requestAction(action);
    if (pathname !== "/connections") {
      navigate({ to: "/connections" });
    }
  };

  return (
    <Dialog
      open={chooserOpen}
      onOpenChange={(open) => {
        if (!open) closeChooser();
      }}
      variant="form"
      title="New connection"
      description="Choose a data source type to connect to LuminAI."
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => handleChoose("new-db")}
          className="group w-full text-left p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-border-focus transition-colors flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
              <Database size={ICON_SIZES.header} aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-text">Database</div>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                Connect PostgreSQL, MySQL, Snowflake, or SQL Server and select
                tables to sync.
              </p>
            </div>
          </div>
          <ArrowRight
            size={ICON_SIZES.dropdown}
            className="text-text-secondary group-hover:text-text transition-colors shrink-0"
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={() => handleChoose("upload")}
          className="group w-full text-left p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-border-focus transition-colors flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
              <Upload size={ICON_SIZES.header} aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-text">File upload</div>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                Upload CSV or JSON datasets (up to 500 MB) and map columns in
                Schema Studio.
              </p>
            </div>
          </div>
          <ArrowRight
            size={ICON_SIZES.dropdown}
            className="text-text-secondary group-hover:text-text transition-colors shrink-0"
            aria-hidden="true"
          />
        </button>

        <p className="text-[11px] text-text-secondary pt-1">
          Connect a source, map it in Schema Studio, then run a pipeline.
        </p>
      </div>
    </Dialog>
  );
};
