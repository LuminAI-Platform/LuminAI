import { useEffect, useRef, useState } from "react";

export const BRAND_LOGO_LIGHT_BG = "/brand/logo-mark.svg";
export const BRAND_LOGO_DARK_BG = "/brand/logo-mark-light.svg";

/**
 * Delays showing a loading indicator by `delayMs` (default 300ms) to prevent
 * flash-of-loader on fast responses, and once shown keeps it visible for at
 * least `minDisplayMs` (default 400ms) to avoid jarring flicker.
 */
export function useDelayedLoading(
  isLoading: boolean,
  options?: { delayMs?: number; minDisplayMs?: number },
): boolean {
  const delayMs = options?.delayMs ?? 300;
  const minDisplayMs = options?.minDisplayMs ?? 400;

  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let minTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      if (!visible) {
        delayTimer = setTimeout(() => {
          shownAtRef.current = Date.now();
          setVisible(true);
        }, delayMs);
      }
    } else if (visible) {
      const elapsed =
        shownAtRef.current !== null
          ? Date.now() - shownAtRef.current
          : minDisplayMs;
      const remaining = Math.max(0, minDisplayMs - elapsed);

      if (remaining === 0) {
        shownAtRef.current = null;
        setVisible(false);
      } else {
        minTimer = setTimeout(() => {
          shownAtRef.current = null;
          setVisible(false);
        }, remaining);
      }
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (minTimer) clearTimeout(minTimer);
    };
  }, [isLoading, visible, delayMs, minDisplayMs]);

  return visible;
}
