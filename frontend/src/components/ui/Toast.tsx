import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

// Icon mappings based on toast severity
const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// Styles using design system tokens
const STYLES = {
  success: {
    border: "border-success-border",
    bg: "bg-success-bg",
    iconColor: "text-success",
    titleColor: "text-text",
  },
  error: {
    border: "border-error-border",
    bg: "bg-error-bg",
    iconColor: "text-error",
    titleColor: "text-error",
  },
  warning: {
    border: "border-warning-border",
    bg: "bg-warning-bg",
    iconColor: "text-warning",
    titleColor: "text-text",
  },
  info: {
    border: "border-border",
    bg: "bg-surface",
    iconColor: "text-primary",
    titleColor: "text-text",
  },
};

/**
 * Individual Toast Notification Card
 */
export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const Icon = ICONS[toast.type];
  const style = STYLES[toast.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 w-84 p-4 rounded-lg border ${style.border} ${style.bg} shadow-md transition-all duration-200`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        <h4
          className={`text-xs font-semibold ${style.titleColor} tracking-tight leading-snug`}
        >
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-[11px] text-text-secondary mt-1 leading-normal break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-text-secondary hover:text-text p-0.5 rounded transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
