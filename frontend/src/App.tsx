import { lazy, Suspense } from "react";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShell } from "./components/layout/AppShell";
import { AdminRoute, ProtectedRoute } from "./components/layout/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { CallbackPage } from "./features/auth/CallbackPage";
import { SandboxLoginPage } from "./features/auth/SandboxLoginPage";
import { NotFoundPage } from "./pages/common/NotFoundPage";

const PageLoadingFallback = () => (
  <div className="flex h-64 w-full items-center justify-center text-sm text-slate-400">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
    Loading...
  </div>
);

const lazyComponent = <T extends Record<string, unknown>>(
  importer: () => Promise<T>,
  exportName: keyof T,
) => {
  const LazyComp = lazy(() =>
    importer().then((module) => ({
      default: module[exportName] as React.ComponentType<
        Record<string, unknown>
      >,
    })),
  );
  return function LazyWrapper(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LazyComp {...props} />
      </Suspense>
    );
  };
};

const DashboardPage = lazyComponent(
  () => import("./pages/dashboard/DashboardPage"),
  "DashboardPage",
);
const ExplorerPage = lazyComponent(
  () => import("./pages/explorer/ExplorerPage"),
  "ExplorerPage",
);
const EntityDetailPage = lazyComponent(
  () => import("./pages/explorer/EntityDetailPage"),
  "EntityDetailPage",
);
const ConnectionsPage = lazyComponent(
  () => import("./pages/connections/ConnectionsPage"),
  "ConnectionsPage",
);
const SchemaMapPage = lazyComponent(
  () => import("./pages/connections/SchemaMapPage"),
  "SchemaMapPage",
);
const PipelinePage = lazyComponent(
  () => import("./pages/connections/PipelinePage"),
  "PipelinePage",
);
const MergeReviewPage = lazyComponent(
  () => import("./pages/connections/MergeReviewPage"),
  "MergeReviewPage",
);
const OntologyPage = lazyComponent(
  () => import("./pages/ontology/OntologyPage"),
  "OntologyPage",
);
const GraphPage = lazyComponent(
  () => import("./pages/graph/GraphPage"),
  "GraphPage",
);
const SettingsPage = lazyComponent(
  () => import("./pages/settings/SettingsPage"),
  "SettingsPage",
);
const UserRegistrationPage = lazyComponent(
  () => import("./features/admin/UserRegistrationPage"),
  "UserRegistrationPage",
);
const TenantRegistrationPage = lazyComponent(
  () => import("./features/admin/TenantRegistrationPage"),
  "TenantRegistrationPage",
);

// 1. Root Route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_shell",
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  ),
});

// 2. Route View Components

// DashboardPage is imported from src/pages/dashboard/DashboardPage

// ExplorerPage is now imported from src/pages/explorer/ExplorerPage

// Connections Page is now imported from src/pages/connections/ConnectionsPage

// Ontology page is imported from src/pages/ontology/OntologyPage

// GraphPage is imported from src/pages/graph/GraphPage

// SettingsPage is imported from src/pages/settings/SettingsPage

// 3. Create Routes Tree
const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/",
  component: DashboardPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/callback",
  component: CallbackPage,
});

const sandboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sandbox",
  component: SandboxLoginPage,
});

const explorerRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/explorer",
  component: ExplorerPage,
});

const entityDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/explorer/entity/$entityId",
  component: EntityDetailPage,
});

const connectionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections",
  component: ConnectionsPage,
});

const schemaMapRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/schema-map",
  component: SchemaMapPage,
});

const pipelineRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/pipelines",
  component: PipelinePage,
});

const mergeReviewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections/merge-review",
  component: MergeReviewPage,
});

const ontologyRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/ontology",
  component: OntologyPage,
});

const graphRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/graph",
  component: GraphPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/settings",
  component: SettingsPage,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/admin/users",
  component: () => (
    <AdminRoute>
      <UserRegistrationPage />
    </AdminRoute>
  ),
});

const adminTenantsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/admin/tenants",
  component: () => (
    <AdminRoute>
      <TenantRegistrationPage />
    </AdminRoute>
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  callbackRoute,
  ...(import.meta.env.DEV ? [sandboxRoute] : []),
  shellRoute.addChildren([
    indexRoute,
    explorerRoute,
    entityDetailRoute,
    connectionsRoute,
    schemaMapRoute,
    pipelineRoute,
    mergeReviewRoute,
    ontologyRoute,
    graphRoute,
    settingsRoute,
    adminUsersRoute,
    adminTenantsRoute,
  ]),
]);

// 4. Create Router
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// 5. App Component wrapper
function App() {
  return <RouterProvider router={router} />;
}

export default App;
