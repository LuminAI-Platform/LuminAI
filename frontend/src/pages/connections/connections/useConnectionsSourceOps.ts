import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { useToast } from "../../../components/ui/ToastProvider";
import type { IngestedFile, UnifiedSource } from "./connectionsTypes";

interface UseConnectionsSourceOpsProps {
  loadConnectors: (isInitial?: boolean) => Promise<void>;
}

export function useConnectionsSourceOps({
  loadConnectors,
}: UseConnectionsSourceOpsProps) {
  const toast = useToast();

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "file" | "connection";
  } | null>(null);
  const [editTarget, setEditTarget] = useState<UnifiedSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [togglingSourceId, setTogglingSourceId] = useState<string | null>(null);

  const handleTestConnection = async (source: UnifiedSource) => {
    setTestingSourceId(source.id);
    try {
      const res = await apiFetch("/api/v1/connections/discover", {
        method: "POST",
        headers: { "X-Suppress-Toast": "true" },
        body: JSON.stringify({ connectionId: source.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || `Connection test failed for ${source.name}`,
        );
      }
      const schemas = await res.json();
      const count = Array.isArray(schemas) ? schemas.length : 0;
      toast.success(
        "Connection verified",
        `${source.name} responded (${count} schema${count === 1 ? "" : "s"} discovered).`,
      );
    } catch (err: unknown) {
      toast.error(
        "Connection test failed",
        err instanceof Error ? err.message : `Could not reach ${source.name}.`,
      );
    } finally {
      setTestingSourceId(null);
    }
  };

  const handleTogglePause = async (source: UnifiedSource) => {
    const nextBackendStatus =
      source.status === "Paused" ? "ACTIVE" : "INACTIVE";
    setTogglingSourceId(source.id);
    try {
      const res = await apiFetch(`/api/v1/connections/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextBackendStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update connection status.");
      }
      toast.success(
        nextBackendStatus === "INACTIVE"
          ? "Connection paused"
          : "Connection resumed",
        `${source.name} is now ${nextBackendStatus === "INACTIVE" ? "paused" : "connected"}.`,
      );
      await loadConnectors(false);
    } catch (err: unknown) {
      toast.error(
        "Status update failed",
        err instanceof Error
          ? err.message
          : "Could not update connection status.",
      );
    } finally {
      setTogglingSourceId(null);
    }
  };

  const handleSaveEdit = async (newName: string) => {
    if (!editTarget || !newName.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await apiFetch(`/api/v1/connections/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update connection.");
      }
      toast.success("Connection updated", `Renamed to "${newName.trim()}".`);
      setEditTarget(null);
      await loadConnectors(false);
    } catch (err: unknown) {
      toast.error(
        "Update failed",
        err instanceof Error ? err.message : "Failed to save changes.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "connection") {
        const res = await apiFetch(`/api/v1/connections/${deleteTarget.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error("Failed to delete connection.");
        }
      } else {
        try {
          await apiFetch(`/api/v1/connections/${deleteTarget.id}`, {
            method: "DELETE",
          });
        } catch {
          // ignore if local-only
        }
        try {
          const cached = JSON.parse(
            localStorage.getItem("local_ingested_files") || "[]",
          );
          const updated = cached.filter(
            (f: IngestedFile) => f.id !== deleteTarget.id,
          );
          localStorage.setItem("local_ingested_files", JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      toast.success(
        "Source deleted",
        `"${deleteTarget.name}" has been removed.`,
      );
      setDeleteTarget(null);
      await loadConnectors(false);
    } catch (err: unknown) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Failed to delete resource.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteTarget,
    setDeleteTarget,
    editTarget,
    setEditTarget,
    isDeleting,
    isSavingEdit,
    testingSourceId,
    togglingSourceId,
    handleTestConnection,
    handleTogglePause,
    handleSaveEdit,
    executeDelete,
  };
}
