import React, { useState } from "react";
import { Search, Loader2 } from "lucide-react";

interface GraphSearchBarProps {
  onSearch: (entityId: string) => void;
  isLoading?: boolean;
}

export const GraphSearchBar: React.FC<GraphSearchBarProps> = ({
  onSearch,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-sm">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search entity name or ID (e.g. Acme Corp)..."
          className="w-full bg-surface/90 backdrop-blur-md text-text placeholder:text-text-secondary text-xs pl-8 pr-16 py-2 rounded-lg border border-border focus:border-border-focus outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!searchTerm.trim() || isLoading}
          className="absolute right-1.5 px-2 py-1 text-[11px] font-semibold bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-md disabled:opacity-40 transition-colors cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Load"}
        </button>
      </div>
    </form>
  );
};
