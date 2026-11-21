import {
  RouterProvider,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShellNotFound } from "./components/layout/AppShellNotFound";
import { LoginPage } from "./features/auth/LoginPage";
import { CallbackPage } from "./features/auth/CallbackPage";
import { SandboxLoginPage } from "./features/auth/SandboxLoginPage";
import { rootRoute, shellRoute } from "./routes/rootRoute";
import { shellChildRoutes } from "./routes/shellRoutes";

// Auth Routes
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  callbackRoute,
  authCallbackRoute,
  ...(import.meta.env.DEV ? [sandboxRoute] : []),
  shellRoute.addChildren(shellChildRoutes),
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
