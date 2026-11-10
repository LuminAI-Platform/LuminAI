import React from "react";
import { HelpCircle } from "lucide-react";

export const ExplorerEmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800/80 rounded-lg text-center p-6 bg-zinc-950/20 select-none">
      <HelpCircle className="w-8 h-8 text-zinc-700 mb-3" />
      <h4 className="text-sm font-bold text-zinc-300">No Entities Found</h4>
      <p className="text-xs text-zinc-500 max-w-xs mt-1.5">
        Your search query did not yield any matching records. Try widening your
        query or altering filters.
      </p>
    </div>
  );
};
