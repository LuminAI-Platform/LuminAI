import React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  /** The label shown inside the tooltip bubble */
  label: string;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Where the tooltip appears relative to the trigger. Defaults to "right". */
  side?: "right" | "left" | "top" | "bottom";
  /** Delay in ms before the tooltip appears. Defaults to 200. */
  delayDuration?: number;
  /** Only render the tooltip when this is true (e.g., sidebar collapsed state) */
  enabled?: boolean;
}

/**
 * SidebarTooltip
 *
 * A Radix UI Tooltip styled to match the LuminAI dark design system:
 * - Dark zinc surface, light text, rounded corners, soft shadow
 * - Appears to the right of the hovered trigger
 * - 200 ms hover delay; disappears instantly on mouse-leave
 * - Fully accessible (aria-describedby, keyboard support) via Radix primitives
 */
export const SidebarTooltip: React.FC<TooltipProps> = ({
  label,
  children,
  side = "right",
  delayDuration = 200,
  enabled = true,
}) => {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={10}
          align="center"
          avoidCollisions
          className={[
            // Layout
            "z-[200] max-w-[220px] px-3 py-1.5",
            // Visual — dark surface matching the app shell
            "bg-zinc-800 text-zinc-100",
            "rounded-lg shadow-xl shadow-black/40",
            "border border-zinc-700/60",
            // Typography
            "text-[12px] font-medium leading-snug",
            // Animation
            "data-[state=delayed-open]:animate-tooltip-in",
            "data-[state=closed]:animate-tooltip-out",
          ].join(" ")}
        >
          {label}
          <RadixTooltip.Arrow className="fill-zinc-800" width={8} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
};

/**
 * Wrap your app (or just the sidebar) with this provider once.
 * skipDelayDuration=0 keeps tooltips snappy when moving between items.
 */
export const TooltipProvider = RadixTooltip.Provider;
