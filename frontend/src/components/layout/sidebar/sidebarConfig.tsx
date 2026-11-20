import type { LucideIcon } from "../../../lib/icons";
import { Icons } from "../../../lib/icons";

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
    icon: Icons.Dashboard,
  },
  {
    label: "Entity Explorer",
    to: "/explorer",
    section: "mesh",
    icon: Icons.EntityExplorer,
  },
  {
    label: "Knowledge Graph",
    to: "/graph",
    section: "mesh",
    icon: Icons.KnowledgeGraph,
  },

  // DATA PIPELINES & DATASETS
  {
    label: "Data Connections",
    to: "/connections",
    section: "pipelines",
    icon: Icons.DataConnections,
  },
  {
    label: "Dataset Catalog",
    to: "/datasets",
    section: "pipelines",
    icon: Icons.Database,
  },
  {
    label: "Projects & Lineage",
    to: "/projects",
    section: "pipelines",
    icon: Icons.GitBranch,
  },
  {
    label: "Schema Studio",
    to: "/connections/schema-map",
    section: "pipelines",
    icon: Icons.SchemaStudio,
  },
  {
    label: "Fusion Review",
    to: "/connections/merge-review",
    section: "pipelines",
    icon: Icons.FusionReview,
    badgeKey: "fusionReview",
  },
  {
    label: "Pipeline Monitor",
    to: "/connections/pipelines",
    section: "pipelines",
    icon: Icons.PipelineMonitor,
  },

  // ANALYTICS & INTELLIGENCE
  {
    label: "SQL & Analytics Studio",
    to: "/analytics/sql",
    section: "analytics",
    icon: Icons.Table,
  },
  {
    label: "ML & AI Studio",
    to: "/datascience/models",
    section: "analytics",
    icon: Icons.Cpu,
  },

  // SYSTEM ARCHITECTURE
  {
    label: "Ontology Manager",
    to: "/ontology",
    section: "system",
    icon: Icons.OntologyManager,
  },
];
