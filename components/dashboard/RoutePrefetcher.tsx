"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RoutePrefetcher() {
  const pathname = usePathname();

  useEffect(() => {
    // Prefetch common routes when in dashboard
    if (pathname?.startsWith("/dashboard")) {
      // Prefetch groups and settlements pages
      const routesToPrefetch = ["/groups", "/settlements", "/expenses"];
      
      routesToPrefetch.forEach((route) => {
        // Use requestIdleCallback for non-critical prefetching
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = route;
            document.head.appendChild(link);
          }, { timeout: 2000 });
        } else {
          // Fallback for Safari
          setTimeout(() => {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.href = route;
            document.head.appendChild(link);
          }, 100);
        }
      });
    }
  }, [pathname]);

  return null;
}
