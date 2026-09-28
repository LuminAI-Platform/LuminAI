/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Toast, type ToastItem, type ToastType } from "./Toast";

interface ToastContextType {
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    show: (item: Omit<ToastItem, "id">) => void;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

// Global custom event name for non-react triggers (e.g. from apiFetch)
const TOAST_EVENT = "luminai:toast";

/**
 * Dispatches a toast from outside the React component tree (e.g., fetch interceptors)
 */
export function showToastNotification(
  type: ToastType,
  title: string,
  description?: string,
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { type, title, description, duration: 5000 },
      }),
    );
  }
}

/**
 * Toast Provider managing notification state, auto-dismiss, and screen stacking
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = "toast_" + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { ...item, id };

      // Limit max 3 visible toasts on screen; dismiss oldest if exceeded
      setToasts((prev) => [...prev.slice(-2), newToast]);

      const duration = item.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, description?: string) =>
      show({ type: "success", title, description }),
    [show],
  );
  const error = useCallback(
    (title: string, description?: string) =>
      show({ type: "error", title, description }),
    [show],
  );
  const warning = useCallback(
    (title: string, description?: string) =>
      show({ type: "warning", title, description }),
    [show],
  );
  const info = useCallback(
    (title: string, description?: string) =>
      show({ type: "info", title, description }),
    [show],
  );

  // Listen to non-react dispatched toast events
  useEffect(() => {
    const handleCustomToast = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<ToastItem, "id">>;
      if (customEvent.detail) {
        show(customEvent.detail);
      }
    };

    window.addEventListener(TOAST_EVENT, handleCustomToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleCustomToast);
    };
  }, [show]);

  const value = {
    toast: { success, error, warning, info, show, dismiss },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport placed top-right */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((item) => (
          <Toast key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}
