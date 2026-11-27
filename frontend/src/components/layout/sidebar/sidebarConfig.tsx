import type { LucideIcon } from "../../../lib/icons";
import { ICON_MAP } from "../../../lib/icons";

export interface NavItem {
  label: string;
  to: string;
  section: "mesh" | "pipelines" | "analytics" | "system";
  icon: LucideIcon;
  badgeKey?: "fusionReview";
}

export const NAV_ITEMS: NavItem[] = [
  // EXPLORE & OVERVIEW
  {
    label: "Dashboard",
    to: "/",
    section: "mesh",
    icon: ICON_MAP.nav.dashboard,
  },
  {
    label: "Entity Explorer",
    to: "/explorer",
    section: "mesh",
    icon: ICON_MAP.nav.entityExplorer,
  },
  {
    label: "Knowledge Graph",
    to: "/graph",
    section: "mesh",
    icon: ICON_MAP.nav.knowledgeGraph,
  },

  // DATA PIPELINES & DATASETS
  {
    label: "Data Connections",
    to: "/connections",
    section: "pipelines",
    icon: ICON_MAP.nav.dataConnections,
  },
  {
    label: "Dataset Catalog",
    to: "/datasets",
    section: "pipelines",
    icon: ICON_MAP.nav.datasetCatalog,
  },
  {
    label: "Projects & Lineage",
    to: "/projects",
    section: "pipelines",
    icon: ICON_MAP.nav.projectsLineage,
  },
  {
    label: "Schema Studio",
    to: "/connections/schema-map",
    section: "pipelines",
    icon: ICON_MAP.nav.schemaStudio,
  },
  {
    label: "Fusion Review",
    to: "/connections/merge-review",
    section: "pipelines",
    icon: ICON_MAP.nav.fusionReview,
    badgeKey: "fusionReview",
  },
  {
    label: "Pipeline Monitor",
    to: "/connections/pipelines",
    section: "pipelines",
    icon: ICON_MAP.nav.pipelineMonitor,
  },

  // ANALYTICS & INTELLIGENCE
  {
    label: "SQL & Analytics Studio",
    to: "/analytics/sql",
    section: "analytics",
    icon: ICON_MAP.nav.sqlAnalytics,
  },
  {
    label: "ML & AI Studio",
    to: "/datascience/models",
    section: "analytics",
    icon: ICON_MAP.nav.mlStudio,
  },

  // SYSTEM ARCHITECTURE
  {
    label: "Ontology Manager",
    to: "/ontology",
    section: "system",
    icon: ICON_MAP.nav.ontologyManager,
  },
];
