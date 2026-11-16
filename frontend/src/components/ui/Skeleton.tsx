import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rectangle" | "circle" | "text";
}

/**
 * Loading Skeleton Pulse Component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "rectangle",
  className = "",
  ...props
}) => {
  const variantClass =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "h-4 rounded-md"
        : "rounded-lg";

  return (
    <div
      className={`animate-pulse bg-surface-muted ${variantClass} ${className}`}
      {...props}
    />
  );
};
