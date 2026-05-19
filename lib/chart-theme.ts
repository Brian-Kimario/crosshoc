import type React from "react";

/**
 * Shared chart theme for all Recharts components in SplitEasy.
 * Colors are chosen to be visually distinct on dark backgrounds.
 */

// ≥6 hex strings suitable for dark backgrounds (teal/emerald/amber/rose/blue/purple/orange palette)
export const CHART_COLORS: string[] = [
  "#14b8a6", // teal-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#3b82f6", // blue-500
  "#a855f7", // purple-500
  "#f97316", // orange-500
  "#06b6d4", // cyan-500
];

// Maps each expense category to a hex color
export const CATEGORY_COLORS: Record<string, string> = {
  food: "#f59e0b",          // amber-500
  transport: "#3b82f6",     // blue-500
  accommodation: "#a855f7", // purple-500
  entertainment: "#f43f5e", // rose-500
  groceries: "#10b981",     // emerald-500
  utilities: "#06b6d4",     // cyan-500
  health: "#14b8a6",        // teal-500
  shopping: "#f97316",      // orange-500
  other: "#6b7280",         // gray-500
};

// Maps each expense category to a human-readable label
export const CATEGORY_LABELS: Record<string, string> = {
  food: "Food & Dining",
  transport: "Transport",
  accommodation: "Accommodation",
  entertainment: "Entertainment",
  groceries: "Groceries",
  utilities: "Utilities",
  health: "Health",
  shopping: "Shopping",
  other: "Other",
};

// Dark-themed CSS-in-JS style for Recharts custom tooltips
export const tooltipStyle: React.CSSProperties = {
  backgroundColor: "#1f2937", // gray-800
  border: "1px solid #374151", // gray-700
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#f9fafb", // gray-50
  fontSize: "13px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
};

/**
 * Returns the hex color for a given category.
 * Falls back to a neutral gray for unknown categories.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#6b7280"; // gray-500 fallback
}
