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
} from "./lazyRoutes";

// 1. Root Route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFoundPage />,
});

// 2. Auth Routes
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

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: CallbackPage,
});

const sandboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sandbox-login",
  component: SandboxLoginPage,
});

// 3. Protected Shell Route
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "shell",
  component: () => (
    <ProtectedRoute>
      <AppShell />
    </ProtectedRoute>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/",
  component: DashboardPage,
});

const explorerRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/explorer",
  component: ExplorerPage,
});

const entityDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/explorer/$entityId",
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
  path: "/connections/pipeline",
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
  authCallbackRoute,
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

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;
