import React, { useState, useEffect, useRef } from "react";
import { Search, X, CornerDownLeft } from "lucide-react";

interface SearchBarProps {
  query: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  suggestions?: string[];
  onSelectSuggestion?: (val: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onChange,
  onSearch,
  suggestions = [],
  onSelectSuggestion,
  placeholder = "Search entities, properties, or schemas...",
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation for suggestions dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        onSearch();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        onSearch();
        setShowDropdown(false);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const selectSuggestion = (val: string) => {
    onChange(val);
    if (onSelectSuggestion) {
      onSelectSuggestion(val);
    }
    setShowDropdown(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl select-none">
      {/* Search Input Container */}
      <div className="relative flex items-center bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 rounded-xl px-4 py-2.5 transition-all duration-300 focus-within:border-blue-500/50 focus-within:shadow-[0_0_12px_rgba(59,130,246,0.15)] group">
        <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors mr-3 shrink-0" />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="bg-transparent text-zinc-100 placeholder:text-zinc-500 outline-none border-none w-full text-sm font-sans"
        />

        {/* Action controls */}
        <div className="flex items-center gap-2 shrink-0">
          {query && (
            <button
              onClick={() => {
                onChange("");
                setShowDropdown(false);
                inputRef.current?.focus();
              }}
              className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-md transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => {
              onSearch();
              setShowDropdown(false);
            }}
            className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/50 rounded-md transition-all flex items-center gap-1 cursor-pointer select-none"
          >
            <span>Search</span>
            <CornerDownLeft className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl shadow-black/80 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3.5 py-2 text-[10px] font-bold text-zinc-500 border-b border-zinc-850 uppercase tracking-widest bg-zinc-900/80">
            Suggested matches
          </div>
          <ul className="divide-y divide-zinc-900">
            {suggestions.map((val, idx) => {
              const isActive = activeIndex === idx;
              return (
                <li
                  key={val + idx}
                  onClick={() => selectSuggestion(val)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`px-4 py-2.5 text-xs text-zinc-200 cursor-pointer flex items-center justify-between transition-colors ${
                    isActive ? "bg-zinc-800/80 text-blue-400" : "hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Search className={`w-3.5 h-3.5 ${isActive ? "text-blue-500" : "text-zinc-500"}`} />
                    <span className="font-medium">{val}</span>
                  </div>
                  {isActive && (
                    <span className="text-[10px] text-zinc-500 font-mono">Select</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
