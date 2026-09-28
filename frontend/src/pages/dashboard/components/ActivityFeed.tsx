import React from "react";
import {
  Activity,
  Play,
  Database,
  Network,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PIPELINE_RUN: <Play className="w-3.5 h-3.5 text-blue-400" />,
  ENTITY_SYNC: <Network className="w-3.5 h-3.5 text-purple-400" />,
  CONNECTION_CREATE: <Database className="w-3.5 h-3.5 text-emerald-400" />,
  DEFAULT: <Activity className="w-3.5 h-3.5 text-zinc-400" />,
};

const STATUS_BADGES: Record<
  string,
  { label: string; variant: BadgeVariant; icon: React.ReactNode }
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

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / 1000,
    );
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateString;
  }
}

/**
 * Activity Feed stream showing recent executions and audit events
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = [],
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="w-full h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl">
        <p className="text-xs text-zinc-500">
          No activity events recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-zinc-800/60 max-h-[380px] overflow-y-auto pr-1">
      {activities.map((item) => {
        const icon = TYPE_ICONS[item.type] ?? TYPE_ICONS.DEFAULT;
        const statusConfig = STATUS_BADGES[item.status] ?? STATUS_BADGES.INFO;

        return (
          <div
            key={item.id}
            className="py-3 px-2 flex items-start justify-between gap-4 hover:bg-zinc-900/50 rounded-lg transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                {icon}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-zinc-200 truncate">
                  {item.title}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-[10px] text-zinc-500">
                {formatRelativeTime(item.timestamp)}
              </span>
              <Badge variant={statusConfig.variant} withDot>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
};
