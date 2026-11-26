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

  const [deleteTarget, setDeleteTarget] = useState<UnifiedSource | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<UnifiedSource | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [togglingSourceId, setTogglingSourceId] = useState<string | null>(null);

  const openDeleteTarget = (source: UnifiedSource | null) => {
    setDeleteError(null);
    setDeleteTarget(source);
  };

  const openEditTarget = (source: UnifiedSource | null) => {
    setEditError(null);
    setEditTarget(source);
  };

  const handleTestConnection = async (
    source: UnifiedSource,
  ): Promise<{ ok: boolean; message: string }> => {
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
      const message = `${source.name} responded (${count} schema${count === 1 ? "" : "s"} discovered).`;
      toast.success("Connection verified", message);
      return { ok: true, message };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `Could not reach ${source.name}.`;
      toast.error("Connection test failed", message);
      return { ok: false, message };
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
    setEditError(null);
    try {
      const res = await apiFetch(`/api/v1/connections/${editTarget.id}`, {
        method: "PUT",
        headers: { "X-Suppress-Toast": "true" },
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
      setEditError(
        err instanceof Error ? err.message : "Failed to save changes.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (deleteTarget.category === "database") {
        const res = await apiFetch(`/api/v1/connections/${deleteTarget.id}`, {
          method: "DELETE",
          headers: { "X-Suppress-Toast": "true" },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to delete connection.");
        }
      } else {
        try {
          const res = await apiFetch(`/api/v1/connections/${deleteTarget.id}`, {
            method: "DELETE",
            headers: { "X-Suppress-Toast": "true" },
          });
          if (!res.ok && res.status !== 404) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to delete connection.");
          }
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status;
          if (status !== 404) {
            throw err;
          }
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
        "Connection deleted",
        `"${deleteTarget.name}" has been permanently removed.`,
      );
      setDeleteTarget(null);
      await loadConnectors(false);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete connection.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteTarget,
    setDeleteTarget: openDeleteTarget,
    deleteError,
    editTarget,
    setEditTarget: openEditTarget,
    editError,
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
