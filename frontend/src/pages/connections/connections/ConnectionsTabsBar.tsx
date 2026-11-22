import React, { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Icons, ICON_SIZES } from "../../../lib/icons";
import type { ConnectionsTab } from "./connectionsTypes";

const TAB_ORDER: ConnectionsTab[] = ["all", "connectors", "files"];

interface ConnectionsTabsBarProps {
  activeTab: ConnectionsTab;
  setActiveTab: (tab: ConnectionsTab) => void;
  unifiedSourcesCount: number;
  customConnectorsCount: number;
  ingestedFilesCount: number;
}

export const ConnectionsTabsBar: React.FC<ConnectionsTabsBarProps> = ({
  activeTab,
  setActiveTab,
  unifiedSourcesCount,
  customConnectorsCount,
  ingestedFilesCount,
}) => {
  const tabRefs = useRef<Record<ConnectionsTab, HTMLButtonElement | null>>({
    all: null,
    connectors: null,
    files: null,
  });

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ConnectionsTab,
  ) => {
    const idx = TAB_ORDER.indexOf(currentTab);
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % TAB_ORDER.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = TAB_ORDER.length - 1;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const nextTab = TAB_ORDER[nextIdx];
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  const tabs: { id: ConnectionsTab; label: string }[] = [
    { id: "all", label: `All sources (${unifiedSourcesCount})` },
    {
      id: "connectors",
      label: `Database connectors (${customConnectorsCount})`,
    },
    { id: "files", label: `Flat files & datasets (${ingestedFilesCount})` },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
      <div
        role="tablist"
        aria-label="Data source categories"
        className="flex flex-wrap items-center gap-5"
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              id={`connections-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-controls="connections-tabpanel"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              className={`text-xs font-semibold pb-2 -mb-[9px] border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isSelected
                  ? "border-primary text-text"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <Link
        to="/connections/schema-map"
        className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1.5 cursor-pointer"
      >
        <Icons.SchemaStudio size={ICON_SIZES.inline} aria-hidden="true" />
        <span>Open Schema Studio</span>
      </Link>
    </div>
  );
};
