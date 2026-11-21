import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api";
import type { EntityDetail } from "../../../pages/explorer/types";

export function useEntityDetailDrawer(
  entityId: string | undefined,
  onClose: () => void,
) {
  const isOpen = Boolean(entityId);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localReveal, setLocalReveal] = useState(false);

  useEffect(() => {
    setLocalReveal(false);
  }, [entityId]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, entityId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!entityId) {
      setDetail(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const fetchDetail = async () => {
      setDetail(null);
      setLoading(true);
      setLoadError(null);
      try {
        const res = await apiFetch(`/api/v1/explorer/entities/${entityId}`, {
          signal: controller.signal,
          headers: { "X-Suppress-Toast": "true" },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as EntityDetail;
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load details",
          );
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchDetail();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entityId]);

  return {
    closeBtnRef,
    detail,
    loading,
    loadError,
    localReveal,
    toggleLocalReveal: () => setLocalReveal((v) => !v),
  };
}
