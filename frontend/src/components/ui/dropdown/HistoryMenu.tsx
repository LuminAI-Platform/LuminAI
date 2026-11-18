import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Tooltip } from "../Tooltip";
import { Icons, ExternalLink, Loader2, ICON_SIZES } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { formatRelativeTime } from "../../../stores/notificationStore";

interface RecentActivityItem {
  id: string;
  type?: string;
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

export const HistoryMenu: React.FC = () => {
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchRecent = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch("/api/v1/dashboard/activity?limit=10", {
          headers: { "X-Suppress-Toast": "true" },
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setActivities(data);
          }
        }
      } catch {
        // standby
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRecent();
    const timer = setInterval(fetchRecent, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const getTargetLink = (type?: string): string => {
    const t = (type || "").toUpperCase();
    if (t === "CONNECTION_CREATE") return "/connections";
    if (t === "SCHEMA_MAP" || t === "SCHEMA_MAP_UPDATE")
      return "/connections/schema-map";
    if (t === "ENTITY_SYNC") return "/explorer";
    if (t === "ONTOLOGY_UPDATE") return "/ontology";
    return "/connections/pipelines";
  };

  return (
    <DropdownMenuRoot>
      <Tooltip label="Recent activity" side="bottom">
        <DropdownMenuTrigger asChild aria-label="Recent activity">
          <button
            type="button"
            aria-label="Recent activity"
            className="p-2 text-text-secondary hover:bg-surface-subtle hover:text-text rounded-lg flex items-center justify-center transition-colors cursor-pointer h-9 w-9 border border-transparent hover:border-border"
          >
            <Icons.History size={ICON_SIZES.header} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" side="bottom" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-bold text-text uppercase tracking-wider">
            Recent Activity
          </span>
          <span className="text-[10px] text-text-muted">Live Stream</span>
        </div>

        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
          {isLoading && activities.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-text-muted gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
              <span className="text-xs">Loading activity...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-6 text-center text-text-muted">
              <p className="text-xs">No recent activity recorded yet.</p>
            </div>
          ) : (
            activities.map((act) => (
              <Link
                key={act.id}
                to={getTargetLink(act.type) as "/"}
                className="p-2 rounded-lg hover:bg-surface-hover flex flex-col gap-0.5 text-xs transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text truncate">
                    {act.title}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {formatRelativeTime(act.timestamp)}
                  </span>
                </div>
                {act.description && (
                  <span className="text-[11px] text-text-secondary truncate">
                    {act.description}
                  </span>
                )}
              </Link>
            ))
          )}
        </div>

        <DropdownMenuSeparator />

        <div className="pt-0.5 px-1">
          <Link
            to="/connections/pipelines"
            className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View execution logs</span>
            <ExternalLink size={ICON_SIZES.inline} aria-hidden="true" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};
