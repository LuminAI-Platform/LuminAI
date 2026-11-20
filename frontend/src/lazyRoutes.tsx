import { lazy, Suspense } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  DashboardSkeleton,
  PipelineMonitorSkeleton,
  ConnectionsSkeleton,
  ExplorerSkeleton,
  GraphSkeleton,
  SchemaMapSkeleton,
  MergeReviewSkeleton,
  OntologySkeleton,
  SettingsSkeleton,
} from "./components/skeletons/RouteSkeletons";

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
  <DashboardSkeleton />,
);
export const ExplorerPage = lazyComponent(
  () => import("./pages/explorer/ExplorerPage"),
  "ExplorerPage",
  <ExplorerSkeleton />,
);
export const EntityDetailPage = lazyComponent(
  () => import("./pages/explorer/EntityDetailPage"),
  "EntityDetailPage",
  <ExplorerSkeleton />,
);
export const ConnectionsPage = lazyComponent(
  () => import("./pages/connections/ConnectionsPage"),
  "ConnectionsPage",
  <ConnectionsSkeleton />,
);
export const SchemaMapPage = lazyComponent(
  () => import("./pages/connections/SchemaMapPage"),
  "SchemaMapPage",
  <SchemaMapSkeleton />,
);
export const PipelinePage = lazyComponent(
  () => import("./pages/connections/PipelinePage"),
  "PipelinePage",
  <PipelineMonitorSkeleton />,
);
export const MergeReviewPage = lazyComponent(
  () => import("./pages/connections/MergeReviewPage"),
  "MergeReviewPage",
  <MergeReviewSkeleton />,
);
export const OntologyPage = lazyComponent(
  () => import("./pages/ontology/OntologyPage"),
  "OntologyPage",
  <OntologySkeleton />,
);
export const GraphPage = lazyComponent(
  () => import("./pages/graph/GraphPage"),
  "GraphPage",
  <GraphSkeleton />,
);
export const SettingsPage = lazyComponent(
  () => import("./pages/settings/SettingsPage"),
  "SettingsPage",
  <SettingsSkeleton />,
);
export const UserRegistrationPage = lazyComponent(
  () => import("./features/admin/UserRegistrationPage"),
  "UserRegistrationPage",
  <SettingsSkeleton />,
);
export const TenantRegistrationPage = lazyComponent(
  () => import("./features/admin/TenantRegistrationPage"),
  "TenantRegistrationPage",
  <SettingsSkeleton />,
);
export const DatasetsPage = lazyComponent(
  () => import("./pages/datasets/DatasetsPage"),
  "DatasetsPage",
  <ConnectionsSkeleton />,
);
export const DatasetDetailPage = lazyComponent(
  () => import("./pages/datasets/DatasetDetailPage"),
  "DatasetDetailPage",
  <ConnectionsSkeleton />,
);
export const SqlStudioPage = lazyComponent(
  () => import("./pages/analytics/SqlStudioPage"),
  "SqlStudioPage",
  <ConnectionsSkeleton />,
);
export const ModelWorkbenchPage = lazyComponent(
  () => import("./pages/datascience/ModelWorkbenchPage"),
  "ModelWorkbenchPage",
  <ConnectionsSkeleton />,
);
export const ProjectsLineagePage = lazyComponent(
  () => import("./pages/projects/ProjectsLineagePage"),
  "ProjectsLineagePage",
  <ConnectionsSkeleton />,
);
