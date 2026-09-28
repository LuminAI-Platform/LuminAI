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

// Color accents for dark theme
const STYLES = {
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/40",
    iconColor: "text-emerald-400",
    glow: "shadow-emerald-500/5",
  },
  error: {
    border: "border-red-500/30",
    bg: "bg-red-950/40",
    iconColor: "text-red-400",
    glow: "shadow-red-500/5",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-950/40",
    iconColor: "text-amber-400",
    glow: "shadow-amber-500/5",
  },
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-950/40",
    iconColor: "text-blue-400",
    glow: "shadow-blue-500/5",
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
      className={`pointer-events-auto flex items-start gap-3 w-84 p-4 rounded-xl border ${style.border} ${style.bg} bg-zinc-900/95 backdrop-blur-md shadow-xl ${style.glow} transition-all duration-300 animate-in fade-in slide-in-from-top-2`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-zinc-100 tracking-tight leading-snug">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-[11px] text-zinc-400 mt-1 leading-normal break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
