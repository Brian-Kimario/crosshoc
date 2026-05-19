"use client";

import { useEffect } from "react";

export function PerformancePatch() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Patch Performance.measure to guard against negative timestamps
    const originalMeasure = window.performance.measure.bind(window.performance);
    window.performance.measure = function(
      measureName: string,
      startOrOptions?: string | PerformanceMeasureOptions,
      endMark?: string
    ): PerformanceMeasure {
      try {
        // Try original call
        if (typeof startOrOptions === "object" && startOrOptions) {
          // Check for negative timestamps in options
          const start = (startOrOptions as any).start;
          if (typeof start === "number" && start < 0) {
            console.warn("[PerformancePatch] Skipping negative start for", measureName);
            // Return a dummy measure
            return {
              name: measureName,
              entryType: "measure",
              startTime: 0,
              duration: 0,
            } as PerformanceMeasure;
          }
        }
        return originalMeasure(measureName, startOrOptions as any, endMark as any);
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("negative")) {
          console.warn("[PerformancePatch] Blocked negative timestamp measure:", measureName);
          // Return dummy measure
          return {
            name: measureName,
            entryType: "measure",
            startTime: 0,
            duration: 0,
          } as PerformanceMeasure;
        }
        throw error;
      }
    };
  }, []);

  return null;
}
