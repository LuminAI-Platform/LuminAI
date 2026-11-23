import React from "react";
import type { UnifiedSource, IngestedFile } from "./connectionsTypes";
import { SourcesTable, SourcesTableSkeleton } from "./SourcesTable";
import {
  AllSourcesEmptyState,
  DatabaseEmptyState,
  FilesEmptyState,
} from "./ConnectionsEmptyStates";

interface ConnectionsTabContentProps {
  isLoading: boolean;
  visibleSources: UnifiedSource[];
  activeTab: string;
  testingSourceId: string | null;
  togglingSourceId: string | null;
  onTestConnection: (source: UnifiedSource) => void;
  onEditSource: (source: UnifiedSource) => void;
  onTogglePause: (source: UnifiedSource) => void;
  onDeleteSource: (source: UnifiedSource) => void;
  onOpenRawPreview: (file: IngestedFile) => void;
  onInspectCleanData: (file: IngestedFile) => void;
  onOpenDbModal: () => void;
  onOpenWizard: () => void;
}

export const ConnectionsTabContent: React.FC<ConnectionsTabContentProps> = ({
  isLoading,
  visibleSources,
  activeTab,
  testingSourceId,
  togglingSourceId,
  onTestConnection,
  onEditSource,
  onTogglePause,
  onDeleteSource,
  onOpenRawPreview,
  onInspectCleanData,
  onOpenDbModal,
  onOpenWizard,
}) => {
  return (
    <div
      id="connections-tabpanel"
      role="tabpanel"
      aria-labelledby={`connections-tab-${activeTab}`}
    >
      {isLoading ? (
        <SourcesTableSkeleton />
      ) : visibleSources.length > 0 ? (
        <SourcesTable
          sources={visibleSources}
          isLoading={false}
          showTypeFilter={activeTab === "all"}
          testingSourceId={testingSourceId}
          togglingSourceId={togglingSourceId}
          onTestConnection={onTestConnection}
          onEditSource={onEditSource}
          onTogglePause={onTogglePause}
          onDeleteSource={onDeleteSource}
          onOpenRawPreview={onOpenRawPreview}
          onInspectCleanData={onInspectCleanData}
        />
      ) : activeTab === "connectors" ? (
        <DatabaseEmptyState onSelectConnector={onOpenDbModal} />
      ) : activeTab === "files" ? (
        <FilesEmptyState onSelectFile={onOpenWizard} />
      ) : (
        <AllSourcesEmptyState
          onSelectConnector={onOpenDbModal}
          onSelectFile={onOpenWizard}
        />
      )}
    </div>
  );
};
