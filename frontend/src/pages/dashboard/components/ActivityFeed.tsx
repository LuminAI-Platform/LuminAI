import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Play,
  Database,
  Network,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ICON_SIZES,
} from "../../../lib/icons";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import {
  formatRelativeTime,
  getActivityTargetRoute,
} from "./activityFeedUtils";

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  link?: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
  limit?: number;
  showViewAll?: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PIPELINE_RUN: <Play className="w-3.5 h-3.5 text-text-secondary" />,
  ENTITY_SYNC: <Network className="w-3.5 h-3.5 text-text-secondary" />,
  CONNECTION_CREATE: <Database className="w-3.5 h-3.5 text-text-secondary" />,
  ONTOLOGY_UPDATE: <Activity className="w-3.5 h-3.5 text-text-secondary" />,
  DEFAULT: <Activity className="w-3.5 h-3.5 text-text-secondary" />,
};

const STATUS_BADGES: Record<
  string,
  { label: string; variant: BadgeVariant; icon?: React.ReactNode }
> = {
  SUCCESS: {
    label: "Completed",
    variant: "success",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  RUNNING: {
    label: "Running",
    variant: "warning",
    icon: <Clock className="w-3 h-3 animate-spin" />,
  },
  FAILED: {
    label: "Failed",
    variant: "danger",
    icon: <XCircle className="w-3 h-3" />,
  },
  INFO: {
    label: "Info",
    variant: "info",
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

/**
 * Live Audit & Activity Stream showing recent executions and audit events.
 * Features:
 * - Rows are links to the run detail view / target resource.
 * - Keyboard focusable with visible focus ring.
 * - Shows the 6 most recent runs with a "View all runs" link to Pipeline Monitor.
 * - Inner scroll with top/bottom fade edges and `overscroll-behavior: contain` (no scroll trapping).
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
          <Activity className="w-5 h-5 text-text-secondary" />
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
          <Database className="w-3.5 h-3.5" />
          <span>Connect a data source</span>
        </Link>
      </div>
    );
  }

  const displayItems = activities.slice(0, limit);

  return (
    <div className="flex flex-col" data-testid="activity-feed-stream">
      {/* Scrollable Container with Fade Edges & No Scroll Trapping */}
      <div className="relative">
        {/* Subtle Top Fade Edge */}
        <div
          className="pointer-events-none sticky top-0 left-0 right-0 h-2.5 bg-gradient-to-b from-surface to-transparent z-10 -mb-2.5 opacity-80"
          aria-hidden="true"
        />

        <div
          className="flex flex-col divide-y divide-border/60 max-h-[360px] overflow-y-auto pr-1 [overscroll-behavior:contain]"
          role="feed"
          aria-label="Recent activity events"
        >
          {displayItems.map((item) => {
            const icon = TYPE_ICONS[item.type] ?? TYPE_ICONS.DEFAULT;
            const statusConfig =
              STATUS_BADGES[item.status] ?? STATUS_BADGES.INFO;
            const route = getActivityTargetRoute(item);

            return (
              <Link
                key={item.id}
                to={route.to}
                hash={route.hash}
                className="group py-3 px-2.5 flex items-start justify-between gap-3.5 hover:bg-surface-subtle active:bg-surface-muted/60 rounded-lg transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface select-none"
                aria-label={`${item.title} - ${item.status}: ${item.description}`}
                tabIndex={0}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-surface-subtle border border-border flex items-center justify-center shrink-0 mt-0.5 group-hover:border-primary/40 group-hover:text-primary transition-colors">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-text group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[10px] text-text-muted">
                    {formatRelativeTime(item.timestamp)}
                  </span>
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

        {/* Subtle Bottom Fade Edge */}
        <div
          className="pointer-events-none sticky bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-surface to-transparent z-10 -mt-3 opacity-80"
          aria-hidden="true"
        />
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
