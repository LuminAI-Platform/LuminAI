import React from "react";
import { ICON_MAP, AlertCircle, ICON_SIZES } from "../../../lib/icons";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { BrandLoader } from "../../../components/ui/BrandLoader";
import type { ActivityItem } from "./ActivityFeed";
import type { ResolvedActivityStatus } from "./activityFeedUtils";

const CompletedIcon = ICON_MAP.status.completed;
const IssuesIcon = ICON_MAP.status.completedWithIssues;
const FailedIcon = ICON_MAP.status.failed;
const QueuedIcon = ICON_MAP.status.queued;
const FileIngestionIcon = ICON_MAP.activity.fileIngestion;
const DatabaseSyncIcon = ICON_MAP.activity.databaseSync;
const SchemaChangeIcon = ICON_MAP.activity.schemaChange;
const GraphIcon = ICON_MAP.nav.knowledgeGraph;

export const ACTIVITY_STATUS_CONFIG: Record<
  ResolvedActivityStatus,
  { label: string; variant: BadgeVariant; icon: React.ReactNode }
> = {
  COMPLETED: {
    label: "Completed",
    variant: "success",
    icon: (
      <CompletedIcon
        size={ICON_SIZES.inline}
        className="text-success"
        aria-hidden="true"
      />
    ),
  },
  COMPLETED_WITH_ISSUES: {
    label: "Completed with issues",
    variant: "warning",
    icon: (
      <IssuesIcon
        size={ICON_SIZES.inline}
        className="text-warning"
        aria-hidden="true"
      />
    ),
  },
  FAILED: {
    label: "Failed",
    variant: "danger",
    icon: (
      <FailedIcon
        size={ICON_SIZES.inline}
        className="text-error"
        aria-hidden="true"
      />
    ),
  },
  RUNNING: {
    label: "Running",
    variant: "primary",
    icon: <BrandLoader variant="inline" size={ICON_SIZES.inline} />,
  },
  QUEUED: {
    label: "Queued",
    variant: "nodata",
    icon: (
      <QueuedIcon
        size={ICON_SIZES.inline}
        className="text-nodata"
        aria-hidden="true"
      />
    ),
  },
  INFO: {
    label: "Info",
    variant: "info",
    icon: (
      <AlertCircle
        size={ICON_SIZES.inline}
        className="text-text-secondary"
        aria-hidden="true"
      />
    ),
  },
};

export function getActivityRowIcon(
  item: ActivityItem,
  statusKey: ResolvedActivityStatus,
): React.ReactNode {
  if (item.type === "PIPELINE_RUN")
    return ACTIVITY_STATUS_CONFIG[statusKey].icon;
  if (item.type === "ENTITY_SYNC") {
    return (
      <GraphIcon
        size={ICON_SIZES.inline}
        className="text-text-secondary"
        aria-hidden="true"
      />
    );
  }
  if (item.type === "CONNECTION_CREATE") {
    return (
      <DatabaseSyncIcon
        size={ICON_SIZES.inline}
        className="text-text-secondary"
        aria-hidden="true"
      />
    );
  }
  if (item.type === "ONTOLOGY_UPDATE" || item.type === "SCHEMA_CHANGE") {
    return (
      <SchemaChangeIcon
        size={ICON_SIZES.inline}
        className="text-text-secondary"
        aria-hidden="true"
      />
    );
  }
  return (
    <FileIngestionIcon
      size={ICON_SIZES.inline}
      className="text-text-secondary"
      aria-hidden="true"
    />
  );
}
