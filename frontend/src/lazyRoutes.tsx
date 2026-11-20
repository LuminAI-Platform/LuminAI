import { lazy, Suspense } from "react";
import type { ComponentType, ReactNode } from "react";
import { RouteLoader } from "./components/ui/BrandLoader";

export const lazyComponent = <T extends Record<string, unknown>>(
  importer: () => Promise<T>,
  exportName: keyof T,
  fallback: ReactNode = null,
) => {
  const LazyComp = lazy(() =>
    importer().then((module) => ({
      default: module[exportName] as ComponentType<Record<string, unknown>>,
    })),
  );
  return function LazyWrapper(props: Record<string, unknown>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComp {...props} />
      </Suspense>
    );
  };
};

export const DashboardPage = lazyComponent(
  () => import("./pages/dashboard/DashboardPage"),
  "DashboardPage",
  <RouteLoader label="Loading Dashboard" delayMs={300} />,
);
export const ExplorerPage = lazyComponent(
  () => import("./pages/explorer/ExplorerPage"),
  "ExplorerPage",
  <RouteLoader label="Loading Entity Explorer" delayMs={300} />,
);
export const EntityDetailPage = lazyComponent(
  () => import("./pages/explorer/EntityDetailPage"),
  "EntityDetailPage",
  <RouteLoader label="Loading Entity Details" delayMs={300} />,
);
export const ConnectionsPage = lazyComponent(
  () => import("./pages/connections/ConnectionsPage"),
  "ConnectionsPage",
  <RouteLoader label="Loading Connections" delayMs={300} />,
);
export const SchemaMapPage = lazyComponent(
  () => import("./pages/connections/SchemaMapPage"),
  "SchemaMapPage",
  <RouteLoader label="Loading Schema Studio" delayMs={300} />,
);
export const PipelinePage = lazyComponent(
  () => import("./pages/connections/PipelinePage"),
  "PipelinePage",
  <RouteLoader label="Loading Pipeline Monitor" delayMs={300} />,
);
export const MergeReviewPage = lazyComponent(
  () => import("./pages/connections/MergeReviewPage"),
  "MergeReviewPage",
  <RouteLoader label="Loading Merge Review" delayMs={300} />,
);
export const OntologyPage = lazyComponent(
  () => import("./pages/ontology/OntologyPage"),
  "OntologyPage",
  <RouteLoader label="Loading Ontology Manager" delayMs={300} />,
);
export const GraphPage = lazyComponent(
  () => import("./pages/graph/GraphPage"),
  "GraphPage",
  <RouteLoader label="Loading Knowledge Graph" delayMs={300} />,
);
export const SettingsPage = lazyComponent(
  () => import("./pages/settings/SettingsPage"),
  "SettingsPage",
  <RouteLoader label="Loading Settings" delayMs={300} />,
);
export const UserRegistrationPage = lazyComponent(
  () => import("./features/admin/UserRegistrationPage"),
  "UserRegistrationPage",
  <RouteLoader label="Loading User Management" delayMs={300} />,
);
export const TenantRegistrationPage = lazyComponent(
  () => import("./features/admin/TenantRegistrationPage"),
  "TenantRegistrationPage",
  <RouteLoader label="Loading Tenant Management" delayMs={300} />,
);
export const DatasetsPage = lazyComponent(
  () => import("./pages/datasets/DatasetsPage"),
  "DatasetsPage",
  <RouteLoader label="Loading Datasets" delayMs={300} />,
);
export const DatasetDetailPage = lazyComponent(
  () => import("./pages/datasets/DatasetDetailPage"),
  "DatasetDetailPage",
  <RouteLoader label="Loading Dataset Details" delayMs={300} />,
);
export const SqlStudioPage = lazyComponent(
  () => import("./pages/analytics/SqlStudioPage"),
  "SqlStudioPage",
  <RouteLoader label="Loading SQL Studio" delayMs={300} />,
);
export const ModelWorkbenchPage = lazyComponent(
  () => import("./pages/datascience/ModelWorkbenchPage"),
  "ModelWorkbenchPage",
  <RouteLoader label="Loading Model Workbench" delayMs={300} />,
);
export const ProjectsLineagePage = lazyComponent(
  () => import("./pages/projects/ProjectsLineagePage"),
  "ProjectsLineagePage",
  <RouteLoader label="Loading Projects & Lineage" delayMs={300} />,
);
