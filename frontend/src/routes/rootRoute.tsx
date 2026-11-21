import { Outlet, createRootRoute, createRoute } from "@tanstack/react-router";
import { AppShell } from "../components/layout/AppShell";
import { AppShellNotFound } from "../components/layout/AppShellNotFound";
import { ProtectedRoute } from "../components/layout/ProtectedRoute";
import { NotFoundPage } from "../pages/common/NotFoundPage";

// 1. Root Route
export const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFoundPage />,
});

// 2. Protected Shell Route
export const shellRoute = createRoute({
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
