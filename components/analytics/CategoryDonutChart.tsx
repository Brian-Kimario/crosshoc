"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getCategoryColor,
  tooltipStyle,
} from "@/lib/chart-theme";
import { formatMoney } from "@/lib/money-utils";

interface CategoryDonutChartProps {
  data: Array<{ category: string; totalCents: number; percentage: number }>;
  currency: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP: Record<"sm" | "md" | "lg", number> = {
  sm: 200,
  md: 280,
  lg: 360,
};

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ name: string; value: number; payload?: { currency: string; percentage: number } }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  const category = entry.name as string;
  const totalCents = entry.value as number;
  const currency = entry.payload?.currency as string;
  const percentage = entry.payload?.percentage as number;

  const label = CATEGORY_LABELS[category] ?? category;
  const formatted = formatMoney(totalCents, currency);

  return (
    <div style={tooltipStyle}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: getCategoryColor(category) }}
        />
        <span className="font-medium text-gray-50">{label}</span>
      </div>
      <div className="text-gray-300 text-xs">{formatted}</div>
      <div className="text-gray-400 text-xs">{percentage.toFixed(1)}%</div>
    </div>
  );
}

export function CategoryDonutChart({
  data,
  currency,
  size = "md",
}: CategoryDonutChartProps) {
  const height = SIZE_MAP[size];

  // Attach currency to each data entry so the tooltip can access it
  const chartData = data.map((d) => ({ ...d, currency }));

  if (data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 text-slate-500"
        style={{ height }}
      >
        <PieChartIcon className="w-10 h-10 opacity-30" />
        <p className="text-sm">No spending data for this period</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="totalCents"
            nameKey="category"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.category}
                fill={getCategoryColor(entry.category)}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 justify-center px-2">
        {data.map((entry) => {
          const label = CATEGORY_LABELS[entry.category] ?? entry.category;
          const color =
            CATEGORY_COLORS[entry.category] ?? getCategoryColor(entry.category);
          return (
            <div
              key={entry.category}
              className="flex items-center gap-1.5 text-xs text-slate-400"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
