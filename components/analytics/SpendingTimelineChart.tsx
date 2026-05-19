"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { CHART_COLORS, tooltipStyle } from "@/lib/chart-theme";
import { formatMoney } from "@/lib/money-utils";
import { formatCurrencyCompact } from "@/lib/format-utils";

interface SpendingTimelineChartProps {
  data: Array<{ week: string; totalCents: number }>;
  currency: string;
}

interface CustomTooltipPayload {
  week: string;
  totalCents: number;
  currency: string;
}

function CustomTooltip({
  active,
  payload,
}: TooltipProps<number, string> & { payload?: Array<{ payload?: CustomTooltipPayload }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0].payload as CustomTooltipPayload;
  const { week, totalCents, currency } = entry;
  const formatted = formatMoney(totalCents, currency);

  return (
    <div style={tooltipStyle}>
      <div className="font-medium text-gray-50 mb-1">{week}</div>
      <div className="text-gray-300 text-xs">{formatted}</div>
    </div>
  );
}

export function SpendingTimelineChart({
  data,
  currency,
}: SpendingTimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-slate-500 h-48">
        <BarChart2 className="w-10 h-10 opacity-30" />
        <p className="text-sm">No spending data for this period</p>
      </div>
    );
  }

  // Attach currency to each data entry so the tooltip can access it
  const chartData = data.map((d) => ({ ...d, currency }));

  return (
    <div className="overflow-hidden">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
        >
          <XAxis
            dataKey="week"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) =>
              formatCurrencyCompact(value, currency)
            }
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          />
          <Bar
            dataKey="totalCents"
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
