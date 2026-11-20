import React from "react";
import { createPortal } from "react-dom";

interface BodyPortalProps {
  children: React.ReactNode;
}

/**
 * Renders overlays, drawers, and dialogs directly under document.body so they
 * escape sidebar/main stacking contexts and cover the entire viewport.
 */
export const BodyPortal: React.FC<BodyPortalProps> = ({ children }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
};
