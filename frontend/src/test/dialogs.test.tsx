import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DeleteConnectionDialog } from "../pages/connections/connections/DeleteConnectionDialog";
import { EditConnectionModal } from "../pages/connections/connections/EditConnectionModal";
import { Toast } from "../components/ui/Toast";
import type { UnifiedSource } from "../pages/connections/connections/connectionsTypes";

const DB_SOURCE: UnifiedSource = {
  id: "conn-1",
  name: "Prod Postgres",
  category: "database",
  typeLabel: "PostgreSQL",
  rawType: "POSTGRESQL",
  status: "Connected",
  host: "db.internal.acme.io",
  createdAt: "2026-11-20T10:00:00Z",
  lastSyncAt: "2026-11-24T15:30:00Z",
  rowsSynced: 1200,
  pipelines: 2,
  configuredPipelines: 2,
};

const IDLE_SOURCE: UnifiedSource = {
  id: "conn-2",
  name: "Staging MySQL",
  category: "database",
  typeLabel: "MySQL",
  rawType: "MYSQL",
  status: "Paused",
  rowsSynced: 0,
  pipelines: 1,
  configuredPipelines: 0,
};

describe("Unified Dialog & Toast components", () => {
  it("exports Dialog and ConfirmDialog", () => {
    expect(Dialog).toBeDefined();
    expect(ConfirmDialog).toBeDefined();
  });

  it("renders Toast with an Undo action button when provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(Toast, {
        toast: {
          id: "t-1",
          type: "info",
          title: "View cleared",
          description: "Run records stay stored on the server.",
          duration: 6000,
          action: { label: "Undo", onClick: () => {} },
        },
        onDismiss: () => {},
      }),
    );
    expect(html).toContain("View cleared");
    expect(html).toContain("Run records stay stored on the server.");
    expect(html).toContain("Undo");
  });

  it("renders DeleteConnectionDialog and EditConnectionModal cleanly when closed", () => {
    expect(
      renderToStaticMarkup(
        React.createElement(DeleteConnectionDialog, {
          source: null,
          isDeleting: false,
          errorMessage: null,
          onClose: () => {},
          onConfirm: () => {},
        }),
      ),
    ).toBe("");

    expect(
      renderToStaticMarkup(
        React.createElement(EditConnectionModal, {
          source: null,
          existingSources: [DB_SOURCE, IDLE_SOURCE],
          isSaving: false,
          isTesting: false,
          errorMessage: null,
          onClose: () => {},
          onSave: () => {},
        }),
      ),
    ).toBe("");
  });
});
