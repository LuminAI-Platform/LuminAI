import React, { useEffect } from "react";
import { BodyPortal } from "../../../components/ui/BodyPortal";
import { FacetFilterSidebar } from "../../../features/explorer/components/FacetFilterSidebar";
import type { EntityType } from "../../../features/ontology/types";

interface ExplorerMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTypes: string[];
  onSelectedTypesChange: (types: string[]) => void;
  facets: Record<string, number>;
  facetGroups: Record<string, Record<string, number>>;
  ontologyTypes: EntityType[];
}

export const ExplorerMobileDrawer: React.FC<ExplorerMobileDrawerProps> = ({
  isOpen,
  onClose,
  selectedTypes,
  onSelectedTypesChange,
  facets,
  facetGroups,
  ontologyTypes,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <BodyPortal>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-[2px] lg:hidden"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Entity filters"
        className="fixed top-0 left-0 z-[9991] h-full w-80 max-w-[85vw] bg-surface border-r border-border shadow-2xl p-4 overflow-y-auto lg:hidden"
      >
        <FacetFilterSidebar
          selectedTypes={selectedTypes}
          onChange={onSelectedTypesChange}
          facets={facets}
          facetGroups={facetGroups}
          ontologyTypes={ontologyTypes}
          inDrawer
          onCloseDrawer={onClose}
        />
      </div>
    </BodyPortal>
  );
};
