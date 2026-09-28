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
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search entity name or ID (e.g. Acme Corp)..."
          className="w-full bg-zinc-900/90 backdrop-blur-md text-zinc-100 placeholder:text-zinc-500 text-xs pl-8 pr-16 py-2 rounded-lg border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!searchTerm.trim() || isLoading}
          className="absolute right-1.5 px-2 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-40 transition-colors cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Load"}
        </button>
      </div>
    </form>
  );
};
