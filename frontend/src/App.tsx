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
import { ConnectionsPage } from "./pages/connections/ConnectionsPage";
import { SchemaMapPage } from "./pages/connections/SchemaMapPage";
import { PipelinePage } from "./pages/connections/PipelinePage";
import { OntologyPage } from "./pages/ontology/OntologyPage";
import { ExplorerPage } from "./pages/explorer/ExplorerPage";
import { EntityDetailPage } from "./pages/explorer/EntityDetailPage";
import { UserRegistrationPage } from "./features/admin/UserRegistrationPage";
import { TenantRegistrationPage } from "./features/admin/TenantRegistrationPage";
import { SandboxLoginPage } from "./features/auth/SandboxLoginPage";
import { NotFoundPage } from "./pages/common/NotFoundPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";

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

// Graph Component
const GraphView = () => {
  return (
    <div>
      <div className="mb-6 select-none">
        <h1 className="text-xl font-semibold text-zinc-100">Graph Explorer</h1>
      </div>
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-zinc-100 font-semibold mb-2 text-base">
          Semantic Connections
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Visualize entity links and relationship degrees.
        </p>

        {/* Mock Graph Visual */}
        <div className="h-64 bg-zinc-950 rounded-lg border border-zinc-800/80 relative flex items-center justify-center overflow-hidden">
          {/* Main Hub Node */}
          <div className="w-20 h-20 rounded-full bg-blue-600/10 border-2 border-blue-500 flex items-center justify-center font-semibold text-zinc-200 z-10 shadow-lg shadow-blue-500/20">
            LuminAI
          </div>

          {/* SVG Connector Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <line
              x1="50%"
              y1="50%"
              x2="25%"
              y2="25%"
              stroke="#27272a"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <line
              x1="50%"
              y1="50%"
              x2="75%"
              y2="30%"
              stroke="#27272a"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <line
              x1="50%"
              y1="50%"
              x2="30%"
              y2="75%"
              stroke="#27272a"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <line
              x1="50%"
              y1="50%"
              x2="70%"
              y2="75%"
              stroke="#27272a"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </svg>

          {/* Floating Nodes */}
          <div className="absolute left-[12%] top-[18%] px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] text-zinc-300 font-medium">
            User Node
          </div>
          <div className="absolute right-[12%] top-[24%] px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] text-zinc-300 font-medium">
            Product Instance
          </div>
          <div className="absolute left-[18%] bottom-[18%] px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] text-zinc-300 font-medium">
            Transactions
          </div>
          <div className="absolute right-[18%] bottom-[18%] px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] text-zinc-300 font-medium">
            Web Event
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Component
const SettingsView = () => {
  return (
    <div>
      <div className="mb-6 select-none">
        <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
      </div>
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-zinc-100 font-semibold mb-2 text-base">
          System Preferences
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Manage global application credentials, dark mode overrides, and system
          diagnostics.
        </p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">
              Tenant Namespace
            </label>
            <input
              type="text"
              readOnly
              value="lumin-global-prod"
              className="w-full max-w-md p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-zinc-200 outline-none text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">
              API Access Key
            </label>
            <input
              type="password"
              readOnly
              value="••••••••••••••••••••••••••••••••"
              className="w-full max-w-md p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-zinc-200 outline-none text-xs font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

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

const ontologyRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/ontology",
  component: OntologyPage,
});

const graphRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/graph",
  component: GraphView,
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/settings",
  component: SettingsView,
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
