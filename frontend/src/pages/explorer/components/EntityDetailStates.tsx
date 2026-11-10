import React from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, AlertCircle } from "lucide-react";

export const EntityLoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 py-24 gap-4">
      <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
      <span className="text-xs text-zinc-500 font-medium">
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
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-bold text-zinc-300 mb-1">
          Entity Not Found
        </h3>
        <p className="text-xs text-zinc-500 max-w-xs">
          {error ?? "The requested entity could not be loaded."}
        </p>
      </div>
      <Link
        to="/explorer"
        className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-xl transition-all cursor-pointer"
      >
        Back to Explorer
      </Link>
    </div>
  );
};
