import React, { useState, useEffect, useRef } from "react";
import { Search, X, CornerDownLeft, ICON_SIZES } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { ParsedQueryFilter } from "../../../pages/explorer/types";

interface SearchBarProps {
  query: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  parsedFilters?: ParsedQueryFilter[];
  onRemoveFilter?: (filter: ParsedQueryFilter) => void;
  suggestions?: string[];
  onSelectSuggestion?: (val: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onChange,
  onSearch,
  parsedFilters = [],
  onRemoveFilter,
  suggestions = [],
  onSelectSuggestion,
  placeholder = "Search entities, or filter like country:US",
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

  // Global Cmd+K / Ctrl+K shortcut to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        onSearch();
      } else if (e.key === "Escape") {
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
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
    <div ref={containerRef} className="relative w-full">
      {/* Larger Search Input Container with subtle accent glow on focus */}
      <div className="relative flex items-center bg-surface border border-border rounded-xl px-4 py-3 shadow-xs transition-all duration-150 motion-reduce:transition-none focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 group">
        <Search
          size={ICON_SIZES.card}
          className="text-text-muted group-focus-within:text-primary transition-colors duration-150 motion-reduce:transition-none mr-3 shrink-0"
          aria-hidden="true"
        />

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
          aria-label="Search entities"
          className="bg-transparent text-text placeholder:text-text-muted outline-none border-none w-full text-sm font-sans"
        />

        {/* Right Controls: Clear, Shortcut Hint, Search Button */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {query && (
            <Tooltip label="Clear search" side="bottom">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setShowDropdown(false);
                  inputRef.current?.focus();
                }}
                className="p-1.5 hover:bg-surface-subtle text-text-muted hover:text-text rounded-lg transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                aria-label="Clear search"
              >
                <X size={ICON_SIZES.inline} aria-hidden="true" />
              </button>
            </Tooltip>
          )}

          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-mono font-medium text-text-muted bg-surface-subtle border border-border rounded-md select-none"
            aria-hidden="true"
          >
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>

          <button
            type="button"
            onClick={() => {
              onSearch();
              setShowDropdown(false);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover rounded-lg transition-colors duration-150 motion-reduce:transition-none flex items-center gap-1.5 cursor-pointer select-none"
          >
            <span>Search</span>
            <CornerDownLeft size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Parsed field:value filter chips */}
      {parsedFilters.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 mt-2"
          role="list"
          aria-label="Active search filters"
        >
          {parsedFilters.map((filter, idx) => (
            <span
              key={`${filter.key}-${filter.value}-${idx}`}
              role="listitem"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-primary-tint text-primary border border-primary-border font-medium"
            >
              <span className="font-mono text-[11px] opacity-80">
                {filter.key}:
              </span>
              <span className="font-semibold">{filter.value}</span>
              {onRemoveFilter && (
                <button
                  type="button"
                  onClick={() => onRemoveFilter(filter)}
                  aria-label={`Remove filter ${filter.key}:${filter.value}`}
                  className="ml-0.5 p-0.5 rounded hover:bg-primary/15 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-40 w-full mt-2 bg-surface border border-border rounded-xl overflow-hidden shadow-lg max-h-60 overflow-y-auto">
          <div className="px-4 py-2 text-[11px] font-semibold text-text-muted border-b border-border-subtle uppercase tracking-wider bg-surface-subtle">
            Matching entities
          </div>
          <ul className="divide-y divide-border-subtle" role="listbox">
            {suggestions.map((val, idx) => {
              const isActive = activeIndex === idx;
              return (
                <li
                  key={val + idx}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectSuggestion(val)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`px-4 py-2.5 text-xs cursor-pointer flex items-center justify-between transition-colors duration-150 motion-reduce:transition-none ${
                    isActive
                      ? "bg-primary-tint text-primary"
                      : "text-text hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Search
                      size={14}
                      className={
                        isActive
                          ? "text-primary shrink-0"
                          : "text-text-muted shrink-0"
                      }
                      aria-hidden="true"
                    />
                    <span className="font-medium truncate">{val}</span>
                  </div>
                  {isActive && (
                    <span className="text-[10px] text-text-muted font-mono shrink-0 ml-2">
                      Enter
                    </span>
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
