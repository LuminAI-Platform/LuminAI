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
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface-subtle">
      <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-4">
        {icon ?? <FolderOpen className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      <p className="text-xs text-text-secondary max-w-sm mt-1 mb-5 leading-relaxed">
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
