import React from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, AlertCircle } from "lucide-react";

export const EntityLoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 py-24 gap-4">
      <RefreshCw className="w-6 h-6 text-text-secondary animate-spin" />
      <span className="text-xs text-text-secondary font-medium">
        Loading entity details...
      </span>
    </div>
  );
};

interface EntityErrorStateProps {
  error: string | null;
}

export const EntityErrorState: React.FC<EntityErrorStateProps> = ({
  error,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 py-20 gap-5">
      <div className="w-12 h-12 rounded-lg bg-error-bg border border-error-border flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-error" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-bold text-text mb-1">Entity Not Found</h3>
        <p className="text-xs text-text-secondary max-w-xs">
          {error ?? "The requested entity could not be loaded."}
        </p>
      </div>
      <Link
        to="/explorer"
        className="px-4 py-2 text-xs font-semibold bg-transparent hover:bg-surface-subtle border border-border text-text hover:text-text rounded-lg transition-all cursor-pointer"
      >
        Back to Explorer
      </Link>
    </div>
  );
};
