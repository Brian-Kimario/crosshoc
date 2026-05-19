// Simple type definition for web vitals metric
interface WebVitalsMetric {
  id: string;
  name: string;
  startTime: number;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  navigationType?: string;
}

export function reportWebVitals(metric: WebVitalsMetric): void {
  // Guard against negative timestamps (React DevTools bug workaround)
  if (metric.startTime < 0 || metric.value < 0) {
    return;
  }

  // Log locally in development
  if (process.env.NODE_ENV === "development") {
    const { name, value, rating } = metric;
    console.log(`[Vitals] ${name}: ${Math.round(value)}ms (${rating})`);
  }

  // In production: send to your analytics
  // e.g. Vercel Analytics (already integrated if using Vercel)
  // or a custom endpoint
  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    // Example: send to custom analytics endpoint
    // fetch('/api/analytics/vitals', {
    //   method: 'POST',
    //   body: JSON.stringify(metric),
    //   keepalive: true,
    // });
  }
}
