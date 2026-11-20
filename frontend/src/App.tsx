import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "./components/layout/AppShell";
import { AppShellNotFound } from "./components/layout/AppShellNotFound";
import { AdminRoute, ProtectedRoute } from "./components/layout/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { CallbackPage } from "./features/auth/CallbackPage";
import { SandboxLoginPage } from "./features/auth/SandboxLoginPage";
import { NotFoundPage } from "./pages/common/NotFoundPage";
import { RouteLoader } from "./components/ui/BrandLoader";
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

const makePendingComponent = (label: string) =>
  function RoutePendingLoader() {
    return <RouteLoader label={label} delayMs={0} />;
  };

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
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  ),
  notFoundComponent: AppShellNotFound,
});

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
    legacyPipelineRoute,
    mergeReviewRoute,
    ontologyRoute,
    graphRoute,
    settingsRoute,
    adminUsersRoute,
    adminTenantsRoute,
  ]),
]);

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: AppShellNotFound,
  defaultPreload: "intent",
  defaultPreloadDelay: 50,
  defaultPendingMs: 300,
  defaultPendingMinMs: 400,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;
