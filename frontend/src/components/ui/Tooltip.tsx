import React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  /** The label shown inside the tooltip bubble */
  label: string;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Where the tooltip appears relative to the trigger. Defaults to "top". */
  side?: "right" | "left" | "top" | "bottom";
  /** Offset in px from the trigger element. Defaults to 8px. */
  sideOffset?: number;
  /** Delay in ms before the tooltip appears. Defaults to 300ms. */
  delayDuration?: number;
  /** Only render the tooltip when this is true (e.g., sidebar collapsed state) */
  enabled?: boolean;
}

/**
 * Tooltip
 *
 * A Radix UI Tooltip styled to match the LuminAI design system:
 * - Surface matching the app shell, text, rounded corners, soft shadow
 * - Standard 300 ms hover and keyboard focus delay; disappears instantly on mouse-leave or blur
 * - Dismissible with Escape key
 * - Respects prefers-reduced-motion
 * - Fully accessible (aria-describedby, keyboard support) via Radix primitives
 */
export const Tooltip: React.FC<TooltipProps> = ({
  label,
  children,
  side = "top",
  sideOffset = 8,
  delayDuration = 300,
  enabled = true,
}) => {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root delayDuration={delayDuration}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={sideOffset}
            align="center"
            avoidCollisions
            className={[
              // Layout
              "z-[200] max-w-[240px] px-3 py-1.5",
              // Visual
              "bg-surface-muted text-text",
              "rounded-lg shadow-sm",
              "border border-border",
              // Typography
              "text-[12px] font-medium leading-snug",
              // Animation with prefers-reduced-motion support
              "data-[state=delayed-open]:animate-tooltip-in motion-reduce:data-[state=delayed-open]:animate-none",
              "data-[state=closed]:animate-tooltip-out motion-reduce:data-[state=closed]:animate-none",
            ].join(" ")}
          >
            {label}
            <RadixTooltip.Arrow
              className="fill-surface-muted"
              width={8}
              height={5}
            />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

/** Sidebar navigation keeps its labels on the outward-facing right edge with 8px offset from rail. */
export const SidebarTooltip: React.FC<Omit<TooltipProps, "side">> = (props) => (
  <Tooltip {...props} side="right" sideOffset={props.sideOffset ?? 8} />
);

/**
 * Wrap the app once so every tooltip shares the same 300ms timing and behavior.
 */
export const TooltipProvider: React.FC<RadixTooltip.TooltipProviderProps> = ({
  delayDuration = 300,
  children,
  ...props
}) => (
  <RadixTooltip.Provider delayDuration={delayDuration} {...props}>
    {children}
  </RadixTooltip.Provider>
);
