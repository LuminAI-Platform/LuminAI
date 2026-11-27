import React from "react";
import { Link } from "@tanstack/react-router";
import { ICON_MAP, ArrowRight, ICON_SIZES } from "../../../lib/icons";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  formatExactTimestamp,
  formatRelativeTime,
  formatActivitySubtitle,
  getActivityTargetRoute,
  getActivityTitleInfo,
  resolveActivityStatus,
} from "./activityFeedUtils";
import {
  ACTIVITY_STATUS_CONFIG,
  getActivityRowIcon,
} from "./activityFeedIcons";

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  link?: string;
  runId?: string;
  datasetName?: string | null;
  connectorName?: string | null;
  connectorType?: string | null;
  pipelineType?: string | null;
  recordsLoaded?: number | null;
  recordsOutput?: number | null;
  recordsQuarantined?: number | null;
  recordsRejected?: number | null;
  recordsFailed?: number | null;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
  limit?: number;
  showViewAll?: boolean;
}

const DatabaseSyncIcon = ICON_MAP.activity.databaseSync;
const ActivityIcon = ICON_MAP.nav.pipelineMonitor;

/**
 * Live Audit & Activity Stream showing recent executions and audit events.
 * Features:
 * - Rows are links to the run detail view / target resource.
 * - Keyboard focusable with visible focus ring.
 * - Shows the 6 most recent runs with a "View all runs" link to Pipeline Monitor.
 * - Natural content height with no inner scroll container so wheel/trackpad/touch always scroll the page.
 * - Empty state with "No activity yet" and "Connect a data source" button.
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = [],
  isLoading = false,
  limit = 6,
  showViewAll = true,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" data-testid="activity-feed-loading">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="w-full h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        className="p-8 text-center border border-dashed border-border rounded-lg bg-surface-subtle/30 flex flex-col items-center justify-center gap-3 select-none"
        data-testid="activity-feed-empty"
      >
        <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted shadow-2xs">
          <ActivityIcon
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <h4 className="text-sm font-semibold text-text">No activity yet</h4>
          <p className="text-xs text-text-secondary">
            Connect a data source to begin running pipelines and observing live
            execution telemetry.
          </p>
        </div>
        <Link
          to="/connections"
          className="mt-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text font-semibold text-xs shadow-xs transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <DatabaseSyncIcon size={ICON_SIZES.inline} aria-hidden="true" />
          <span>Connect a data source</span>
        </Link>
      </div>
    );
  }

  const displayItems = activities.slice(0, limit);

  return (
    <div className="flex flex-col" data-testid="activity-feed-stream">
      <div
        className="flex flex-col divide-y divide-border/60"
        role="feed"
        aria-label="Recent activity events"
      >
        {displayItems.map((item) => {
          const statusKey = resolveActivityStatus(item);
          const statusConfig = ACTIVITY_STATUS_CONFIG[statusKey];
          const icon = getActivityRowIcon(item, statusKey);
          const route = getActivityTargetRoute(item);
          const { title, runIdLabel, secondaryTag } =
            getActivityTitleInfo(item);
          const subtitle = formatActivitySubtitle(item);
          const exactTime = formatExactTimestamp(item.timestamp);

          return (
            <Link
              key={item.id}
              to={route.to}
              hash={route.hash}
              className="group py-3 px-2.5 flex items-start justify-between gap-3.5 hover:bg-surface-subtle active:bg-surface-muted/60 rounded-lg transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface select-none"
              aria-label={`${title}${runIdLabel ? ` ${runIdLabel}` : ""} - ${statusConfig.label}: ${subtitle}`}
              tabIndex={0}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className="w-7 h-7 rounded-lg bg-surface-subtle border border-border flex items-center justify-center shrink-0 mt-0.5 group-hover:border-primary/40 transition-colors"
                  aria-hidden="true"
                >
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <h4
                      className="text-xs font-semibold text-text group-hover:text-primary transition-colors truncate max-w-full"
                      title={title}
                    >
                      {title}
                    </h4>
                    {runIdLabel && (
                      <span className="text-[10px] font-mono text-text-muted shrink-0">
                        {runIdLabel}
                      </span>
                    )}
                    {secondaryTag && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-text-secondary shrink-0">
                        {secondaryTag}
                      </span>
                    )}
                  </div>
                  {subtitle && (
                    <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <time
                  dateTime={item.timestamp}
                  title={exactTime}
                  className="text-[10px] text-text-muted whitespace-nowrap"
                >
                  {formatRelativeTime(item.timestamp)}
                </time>
                <Badge variant={statusConfig.variant} withDot>
                  {statusConfig.label}
                </Badge>
                <ArrowRight
                  size={ICON_SIZES.inline}
                  className="text-text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-all shrink-0"
                  aria-hidden="true"
                />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer link to Pipeline Monitor */}
      {showViewAll && (
        <div className="pt-3 mt-1 border-t border-border flex items-center justify-between text-xs">
          <span className="text-[11px] text-text-muted">
            Showing {displayItems.length} of {activities.length}{" "}
            {activities.length === 1 ? "run" : "runs"}
          </span>
          <Link
            to="/connections/pipelines"
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-hover outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded px-1.5 py-0.5 transition-colors cursor-pointer"
            aria-label="View all runs in Pipeline Monitor"
          >
            <span>View all runs</span>
            <ArrowRight size={ICON_SIZES.inline} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
};
