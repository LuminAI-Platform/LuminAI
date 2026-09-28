import React from "react";
import { FolderOpen } from "lucide-react";
import { Button, type ButtonProps } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionProps?: Partial<ButtonProps>;
}

/**
 * Reusable Empty State pattern for empty tables, search results, and queues
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionProps,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
        {icon ?? <FolderOpen className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-semibold text-zinc-200">{title}</h4>
      <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-5 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <Button size="sm" onClick={onAction} {...actionProps}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
