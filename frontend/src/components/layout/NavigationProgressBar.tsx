import React, { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Top navigation progress bar for instant visual feedback on route transitions.
 * Listens to TanStack Router's pending state and animates smoothly across the top.
 * Fully supports light/dark themes and respects prefers-reduced-motion.
 */
export const NavigationProgressBar: React.FC = () => {
  const isPending = useRouterState({
    select: (state) => state.status === "pending" || state.isLoading,
  });

  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timer1: ReturnType<typeof setTimeout>;
    let timer2: ReturnType<typeof setTimeout>;
    let timer3: ReturnType<typeof setTimeout>;
    let timerDone: ReturnType<typeof setTimeout>;

    if (isPending) {
      setIsVisible(true);
      setProgress(20);

      timer1 = setTimeout(() => {
        setProgress(45);
      }, 80);

      timer2 = setTimeout(() => {
        setProgress(75);
      }, 200);

      timer3 = setTimeout(() => {
        setProgress(90);
      }, 500);
    } else {
      // Complete and fade out
      setProgress(100);
      timerDone = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 250);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerDone);
    };
  }, [isPending]);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)] transition-all duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `${progress}%`,
          opacity: isVisible ? 1 : 0,
        }}
      />
    </div>
  );
};
