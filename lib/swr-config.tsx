"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const globalFetcher = async (url: string) => {
  const res = await fetch(url, {
    credentials: "include", // always send auth cookies
  });

  if (!res.ok) {
    const error = new Error("API request failed") as any;
    try {
      const body = await res.json();
      error.message = body.error ?? "Request failed";
      error.status = res.status;
      error.info = body;
    } catch {
      error.status = res.status;
    }
    throw error;
  }

  return res.json();
};

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,

        // Revalidate when window regains focus (user returns to tab)
        revalidateOnFocus: true,

        // Revalidate when network reconnects
        revalidateOnReconnect: true,

        // Retry failed requests (but not auth errors or rate limits)
        shouldRetryOnError: (err) => {
          return err?.status !== 401 &&
                 err?.status !== 403 &&
                 err?.status !== 404 &&
                 err?.status !== 429; // Too Many Requests
        },

        // Retry up to 3 times with exponential backoff
        errorRetryCount: 3,

        // Deduplicate requests within 2 seconds
        dedupingInterval: 2000,

        // Keep previous data while revalidating (prevents loading flicker)
        keepPreviousData: true,

        // Global error handler — log but don't crash
        onError: (error, key) => {
          if (error?.status === 401) {
            // Token expired — redirect to login
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            return;
          }
          console.error(`[SWR] Error on ${key}:`, error?.message);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

// Export fetcher for use with preload
export { globalFetcher };
