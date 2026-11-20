import React, { useState, useEffect, useRef, useId } from "react";
import { Search, Loader2 } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { useThemeStore } from "../../../stores/themeStore";
import { getEntityColor } from "../../../lib/entityColors";
import type { SuggestedEntity } from "../useGraphData";

interface GraphSearchBarProps {
  onSearch: (entityId: string, label?: string) => void;
  isLoading?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const GraphSearchBar: React.FC<GraphSearchBarProps> = ({
  onSearch,
  isLoading = false,
  inputRef,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedEntity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const isDark = useThemeStore((s) => s.isDark);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Debounced autocomplete via existing /api/v1/explorer/search endpoint
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch(
          `/api/v1/explorer/search?query=${encodeURIComponent(trimmed)}&size=6`,
          {
            headers: { "X-Suppress-Toast": "true" },
            signal: controller.signal,
          },
        );
        const data = await res.json();
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.content)
            ? data.content
            : Array.isArray(data?.results)
              ? data.results
              : [];

        const mapped: SuggestedEntity[] = rawItems
          .filter((item: Record<string, unknown>) => Boolean(item?.id))
          .slice(0, 6)
          .map((item: Record<string, unknown>) => ({
            id: String(item.id),
            canonicalName: String(
              item.canonicalName || item.label || item.name || item.id,
            ),
            entityType: String(item.entityType || "Entity"),
          }));

        setSuggestions(mapped);
        setIsOpen(mapped.length > 0);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelectSuggestion = (item: SuggestedEntity) => {
    setSearchTerm(item.canonicalName);
    setIsOpen(false);
    setActiveIndex(-1);
    onSearch(item.id, item.canonicalName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      handleSelectSuggestion(suggestions[activeIndex]);
      return;
    }

    // If user typed an exact canonical name from suggestions, load its UUID
    const exactMatch = suggestions.find(
      (s) => s.canonicalName.toLowerCase() === trimmed.toLowerCase(),
    );
    setIsOpen(false);
    if (exactMatch) {
      onSearch(exactMatch.id, exactMatch.canonicalName);
    } else {
      onSearch(trimmed, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-80 min-w-[288px] max-w-full shrink-0"
    >
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Search knowledge graph entities"
      >
        <div className="relative flex items-center">
          <Search
            className="w-3.5 h-3.5 text-text-secondary absolute left-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search entity name or ID"
            aria-label="Search entity name or ID"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listboxId : undefined}
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
            }
            role="combobox"
            autoComplete="off"
            className="w-full bg-surface text-text placeholder:text-text-secondary text-xs pl-8 pr-16 py-2 rounded-lg border border-border focus:border-border-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
          />
          <button
            type="submit"
            disabled={!searchTerm.trim() || isLoading}
            className="absolute right-1.5 px-2.5 py-1 text-[11px] font-semibold bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-label="Loading" />
            ) : (
              "Load"
            )}
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching entities"
          className="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-border bg-surface p-1.5 shadow-lg shadow-black/10 dark:shadow-black/40 max-h-[320px] overflow-y-auto animate-dropdown-in select-none flex flex-col gap-0.5"
        >
          {isSearching && suggestions.length === 0 ? (
            <li className="px-2.5 py-2 text-xs text-text-muted">
              Searching...
            </li>
          ) : (
            suggestions.map((item, idx) => {
              const color = getEntityColor(item.entityType, isDark);
              const isHighlighted = idx === activeIndex;
              return (
                <li
                  key={item.id}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full h-9 min-h-[36px] px-2.5 rounded-lg flex items-center justify-between gap-2.5 text-sm font-medium cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-primary-tint text-primary font-semibold"
                      : "text-text hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.canonicalName}</span>
                  </div>
                  <span className="text-[11px] text-text-secondary shrink-0 px-1.5 py-0.5 rounded bg-surface-subtle border border-border">
                    {item.entityType}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
