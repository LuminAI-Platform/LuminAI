import { createRoute, redirect } from "@tanstack/react-router";
import { AdminRoute } from "../components/layout/ProtectedRoute";
import { RouteLoader } from "../components/ui/BrandLoader";
import {
  DashboardPage,
  ExplorerPage,
  EntityDetailPage,
  ConnectionsPage,
  SchemaMapPage,
  PipelinePage,
  MergeReviewPage,
  OntologyPage,
  GraphPage,
  SettingsPage,
  UserRegistrationPage,
  TenantRegistrationPage,
  DatasetsPage,
  DatasetDetailPage,
  SqlStudioPage,
  ModelWorkbenchPage,
  ProjectsLineagePage,
} from "../lazyRoutes";
import { shellRoute } from "./rootRoute";

const makePendingComponent = (label: string) =>
  function RoutePendingLoader() {
    return <RouteLoader label={label} delayMs={0} />;
  };

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/",
  component: DashboardPage,
  pendingComponent: makePendingComponent("Loading Dashboard"),
});

const explorerRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/explorer",
  component: ExplorerPage,
  pendingComponent: makePendingComponent("Loading Entity Explorer"),
});

const entityDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/explorer/$entityId",
  component: EntityDetailPage,
  pendingComponent: makePendingComponent("Loading Entity Details"),
});

const connectionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections",
  component: ConnectionsPage,
  pendingComponent: makePendingComponent("Loading Connections"),
});

const schemaMapRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/schema-map",
  component: SchemaMapPage,
  pendingComponent: makePendingComponent("Loading Schema Studio"),
});

const pipelineRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/pipelines",
  component: PipelinePage,
  pendingComponent: makePendingComponent("Loading Pipeline Monitor"),
});

const legacyPipelineRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/pipeline",
  beforeLoad: () => {
    throw redirect({ to: "/connections/pipelines" });
  },
});

const mergeReviewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/merge-review",
  component: MergeReviewPage,
  pendingComponent: makePendingComponent("Loading Merge Review"),
});

const ontologyRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/ontology",
  component: OntologyPage,
  pendingComponent: makePendingComponent("Loading Ontology Manager"),
});

const graphRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/graph",
  component: GraphPage,
  pendingComponent: makePendingComponent("Loading Knowledge Graph"),
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/settings",
  component: SettingsPage,
  pendingComponent: makePendingComponent("Loading Settings"),
});

const adminUsersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/admin/users",
  component: () => (
    <AdminRoute>
      <UserRegistrationPage />
    </AdminRoute>
  ),
  pendingComponent: makePendingComponent("Loading User Management"),
});

const adminTenantsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/admin/tenants",
  component: () => (
    <AdminRoute>
      <TenantRegistrationPage />
    </AdminRoute>
  ),
  pendingComponent: makePendingComponent("Loading Tenant Management"),
});

const datasetsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/datasets",
  component: DatasetsPage,
  pendingComponent: makePendingComponent("Loading Datasets"),
});

const datasetDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/datasets/$datasetId",
  component: DatasetDetailPage,
  pendingComponent: makePendingComponent("Loading Dataset Details"),
});

const sqlStudioRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/analytics/sql",
  component: SqlStudioPage,
  pendingComponent: makePendingComponent("Loading SQL Studio"),
});

const modelWorkbenchRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/datascience/models",
  component: ModelWorkbenchPage,
  pendingComponent: makePendingComponent("Loading Model Workbench"),
});

const projectsLineageRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/projects",
  component: ProjectsLineagePage,
  pendingComponent: makePendingComponent("Loading Projects & Lineage"),
});

export const shellChildRoutes = [
  indexRoute,
  explorerRoute,
  entityDetailRoute,
  connectionsRoute,
  schemaMapRoute,
  pipelineRoute,
  legacyPipelineRoute,
  mergeReviewRoute,
  ontologyRoute,
  graphRoute,
  settingsRoute,
  adminUsersRoute,
  adminTenantsRoute,
  datasetsRoute,
  datasetDetailRoute,
  sqlStudioRoute,
  modelWorkbenchRoute,
  projectsLineageRoute,
];
