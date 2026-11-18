import type { ActivityItem } from "./ActivityFeed";

export function formatRelativeTime(dateString: string): string {
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
 * Resolves the destination route and optional fragment anchor for an activity item.
 */
export function getActivityTargetRoute(item: ActivityItem): {
  to: string;
  hash?: string;
} {
  if (item.link) {
    return { to: item.link };
  }
  switch (item.type) {
    case "PIPELINE_RUN": {
      const cleanId = item.id.replace(/^run-/, "");
      return {
        to: "/connections/pipelines",
        hash: `pipeline-job-${cleanId}`,
      };
    }
    case "CONNECTION_CREATE":
      return { to: "/connections" };
    case "ENTITY_SYNC":
      return { to: "/explorer" };
    case "ONTOLOGY_UPDATE":
      return { to: "/ontology" };
    default:
      return { to: "/connections/pipelines" };
  }
}
