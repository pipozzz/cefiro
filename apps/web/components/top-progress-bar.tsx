"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin loading bar pinned to the top of the viewport that animates while an
 * App Router navigation is in flight — feedback for the gap between a click and
 * the next page painting.
 *
 * App Router exposes no navigation-event API, so the bar is driven from both
 * ends: it STARTS when a navigation is triggered (an internal link click, or a
 * `history.pushState` from `router.push`) and FINISHES when the resolved route
 * changes `pathname`/`searchParams`. A route change with no start in flight
 * (e.g. a `router.replace` that only rewrites the query) is ignored, so the bar
 * never flashes for navigations the user didn't wait on.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const loadingRef = useRef(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    function stopTrickle() {
      if (trickleRef.current) {
        clearInterval(trickleRef.current);
        trickleRef.current = null;
      }
    }

    function start() {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      if (doneRef.current) {
        clearTimeout(doneRef.current);
        doneRef.current = null;
      }

      setVisible(true);
      setProgress(8);

      // Ease toward 90% and hold there until the navigation actually resolves.
      trickleRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + (90 - p) * 0.1 : p));
      }, 200);
    }

    // Internal link clicks: the most common navigation trigger.
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.("a");
      const href = anchor?.getAttribute("href");

      if (!href || anchor?.target === "_blank" || anchor?.hasAttribute("download")) {
        return;
      }

      try {
        const url = new URL(href, window.location.href);

        // Same-origin, and actually a different page (not just a hash change).
        if (url.origin !== window.location.origin) {
          return;
        }

        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }

        start();
      } catch {
        // A non-URL href (e.g. "mailto:") is not a navigation we track.
      }
    }

    // Programmatic navigation: router.push wraps history.pushState.
    const originalPushState = window.history.pushState.bind(window.history);

    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      start();

      return originalPushState(...args);
    }) as typeof window.history.pushState;

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", start);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", start);
      window.history.pushState = originalPushState;
      stopTrickle();

      if (doneRef.current) {
        clearTimeout(doneRef.current);
      }
    };
  }, []);

  // Route resolved: finish the bar (only if a navigation was actually in flight).
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;

      return;
    }

    if (!loadingRef.current) {
      return;
    }

    loadingRef.current = false;

    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }

    setProgress(100);

    doneRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        // `text-primary` makes `currentColor` the brand colour, so the soft
        // leading glow tints to match the bar whatever the theme.
        className="bg-primary text-primary h-full shadow-[0_0_8px_currentColor]"
        style={{
          width: `${progress}%`,
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}
