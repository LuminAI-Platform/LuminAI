import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
} from "@tanstack/react-router";
import { AppShell } from "./components/layout/AppShell";

// 1. Root Route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
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

// Dashboard Component
const DashboardView = () => {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-100 mb-6 select-none">
        Dashboard
      </h1>

      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-12 text-center mb-6 flex flex-col items-center">
        {/* Terminal Icon */}
        <div className="w-14 h-14 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-center text-blue-500 mb-6">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
          Welcome to LuminAI
        </h2>
        <p className="text-sm text-zinc-400 max-w-xl mb-10 leading-relaxed">
          Your enterprise data environment is ready. Orchestrate multi-modal
          pipelines, define semantic schemas, and deploy production-grade AI
          applications from a single command center.
        </p>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
          <Link
            to="/connections"
            className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 text-left cursor-pointer transition-all duration-200 hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5 flex flex-col gap-3 group"
          >
            <div className="text-blue-500 group-hover:text-blue-400 transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="14" y2="12" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">
              Connect Source
            </span>
            <span className="text-[12px] text-zinc-500 leading-normal">
              Ingest data from Snowflake, S3, or real-time Kafka streams.
            </span>
          </Link>

          <Link
            to="/explorer"
            className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 text-left cursor-pointer transition-all duration-200 hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5 flex flex-col gap-3 group"
          >
            <div className="text-blue-500 group-hover:text-blue-400 transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">
              Build Pipeline
            </span>
            <span className="text-[12px] text-zinc-500 leading-normal">
              Design ETL flows with our low-code visual canvas or Python SDK.
            </span>
          </Link>

          <Link
            to="/graph"
            className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 text-left cursor-pointer transition-all duration-200 hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5 flex flex-col gap-3 group"
          >
            <div className="text-blue-500 group-hover:text-blue-400 transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">
              Deploy App
            </span>
            <span className="text-[12px] text-zinc-500 leading-normal">
              Expose your data as a secure REST API or LLM agent endpoint.
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

// Explorer Component
const ExplorerView = () => {
  return (
    <div>
      <div className="mb-6 select-none">
        <h1 className="text-xl font-semibold text-zinc-100">Explorer</h1>
      </div>
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-zinc-100 font-semibold mb-2 text-base">
          Data Catalog
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Browse and manage schemas, files, and ingestion tables.
        </p>

        <div className="flex flex-col gap-3">
          {[
            {
              name: "users_gold_v2",
              type: "Table",
              size: "14.2 MB",
              updated: "2 mins ago",
            },
            {
              name: "sales_raw_parquet",
              type: "S3 Folder",
              size: "1.4 GB",
              updated: "1 hr ago",
            },
            {
              name: "stripe_transactions",
              type: "API Stream",
              size: "Real-time",
              updated: "Active",
            },
          ].map((item) => (
            <div
              key={item.name}
              className="flex justify-between items-center p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-lg"
            >
              <div className="flex items-center">
                <span className="font-semibold text-zinc-200 text-sm">
                  {item.name}
                </span>
                <span className="text-[10px] text-zinc-400 ml-3 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-medium">
                  {item.type}
                </span>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-4">
                <span>{item.size}</span>
                <span>{item.updated}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Connections Component
const ConnectionsView = () => {
  return (
    <div>
      <div className="mb-6 select-none">
        <h1 className="text-xl font-semibold text-zinc-100">Connections</h1>
      </div>
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-zinc-100 font-semibold mb-2 text-base">
          Data Connectors
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Integrate and synchronize external databases and stream providers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              name: "Snowflake",
              status: "Connected",
              pipelines: 4,
              type: "Warehouse",
            },
            {
              name: "AWS S3",
              status: "Connected",
              pipelines: 12,
              type: "Storage",
            },
            {
              name: "Kafka Streams",
              status: "Connected",
              pipelines: 2,
              type: "Stream",
            },
            {
              name: "PostgreSQL",
              status: "Disconnected",
              pipelines: 0,
              type: "Database",
            },
          ].map((conn) => (
            <div
              key={conn.name}
              className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg flex flex-col gap-3"
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-zinc-100 text-[15px]">
                  {conn.name}
                </span>
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                    conn.status === "Connected"
                      ? "text-emerald-500"
                      : "text-zinc-500"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      conn.status === "Connected"
                        ? "bg-emerald-500"
                        : "bg-zinc-600"
                    }`}
                  />
                  {conn.status}
                </span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400 border-t border-zinc-900 pt-2 mt-1">
                <span>Type: {conn.type}</span>
                <span>{conn.pipelines} Pipelines</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Ontology Component
const OntologyView = () => {
  return (
    <div>
      <div className="mb-6 select-none">
        <h1 className="text-xl font-semibold text-zinc-100">Ontology</h1>
      </div>
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-zinc-100 font-semibold mb-2 text-base">
          Semantic Model
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Define entity classes, property mappings, and relationships for the
          knowledge graph.
        </p>

        <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-zinc-950">
          <div className="flex bg-zinc-900/50 p-4 font-semibold border-b border-zinc-800/80 text-xs text-zinc-300">
            <div className="flex-2">Entity Class</div>
            <div className="flex-2">Inherits From</div>
            <div className="flex-1">Attributes</div>
          </div>
          {[
            { name: "User", inherits: "Agent", attr: 8 },
            { name: "Product", inherits: "Thing", attr: 14 },
            { name: "Transaction", inherits: "Event", attr: 6 },
            { name: "Organization", inherits: "Agent", attr: 11 },
          ].map((item) => (
            <div
              key={item.name}
              className="flex p-4 border-b border-zinc-800/80 text-xs items-center"
            >
              <div className="flex-2 font-semibold text-zinc-200">
                {item.name}
              </div>
              <div className="flex-2 text-zinc-400">{item.inherits}</div>
              <div className="flex-1 text-blue-500 font-medium">
                {item.attr} fields
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardView,
});

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/explorer",
  component: ExplorerView,
});

const connectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connections",
  component: ConnectionsView,
});

const ontologyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ontology",
  component: OntologyView,
});

const graphRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/graph",
  component: GraphView,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsView,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  explorerRoute,
  connectionsRoute,
  ontologyRoute,
  graphRoute,
  settingsRoute,
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
