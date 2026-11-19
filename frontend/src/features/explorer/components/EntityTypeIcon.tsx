import React from "react";
import { getEntityTypeIcon } from "../../../pages/explorer/utils";

interface EntityTypeIconProps {
  entityType?: string | null;
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

/**
 * Renders the distinct, stable Lucide icon for an entity type without
 * triggering dynamic component creation inside parent render bodies.
 */
export const EntityTypeIcon: React.FC<EntityTypeIconProps> = ({
  entityType,
  size = 16,
  className,
  "aria-hidden": ariaHidden = true,
}) => {
  const iconComponent = getEntityTypeIcon(entityType);
  return React.createElement(iconComponent, {
    size,
    className,
    "aria-hidden": ariaHidden,
  });
};
