import { lazy, Suspense } from "react";
import type { ComponentType } from "react";

export const lazyComponent = <T extends Record<string, unknown>>(
  importer: () => Promise<T>,
  exportName: keyof T,
) => {
  const LazyComp = lazy(() =>
    importer().then((module) => ({
      default: module[exportName] as ComponentType<Record<string, unknown>>,
    })),
  );
  return function LazyWrapper(props: Record<string, unknown>) {
    return (
      <Suspense fallback={null}>
        <LazyComp {...props} />
      </Suspense>
    );
  };
};

export const DashboardPage = lazyComponent(
  () => import("./pages/dashboard/DashboardPage"),
  "DashboardPage",
);
export const ExplorerPage = lazyComponent(
  () => import("./pages/explorer/ExplorerPage"),
  "ExplorerPage",
);
export const EntityDetailPage = lazyComponent(
  () => import("./pages/explorer/EntityDetailPage"),
  "EntityDetailPage",
);
export const ConnectionsPage = lazyComponent(
  () => import("./pages/connections/ConnectionsPage"),
  "ConnectionsPage",
);
export const SchemaMapPage = lazyComponent(
  () => import("./pages/connections/SchemaMapPage"),
  "SchemaMapPage",
);
export const PipelinePage = lazyComponent(
  () => import("./pages/connections/PipelinePage"),
  "PipelinePage",
);
export const MergeReviewPage = lazyComponent(
  () => import("./pages/connections/MergeReviewPage"),
  "MergeReviewPage",
);
export const OntologyPage = lazyComponent(
  () => import("./pages/ontology/OntologyPage"),
  "OntologyPage",
);
export const GraphPage = lazyComponent(
  () => import("./pages/graph/GraphPage"),
  "GraphPage",
);
export const SettingsPage = lazyComponent(
  () => import("./pages/settings/SettingsPage"),
  "SettingsPage",
);
export const UserRegistrationPage = lazyComponent(
  () => import("./features/admin/UserRegistrationPage"),
  "UserRegistrationPage",
);
export const TenantRegistrationPage = lazyComponent(
  () => import("./features/admin/TenantRegistrationPage"),
  "TenantRegistrationPage",
);
