"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { CHART_COLORS, tooltipStyle } from "@/lib/chart-theme";
import { formatMoney } from "@/lib/money-utils";
import { formatCurrencyCompact } from "@/lib/format-utils";

interface DailyTrendChartProps {
  data: Array<{ date: string; totalCents: number }>;
  currency: string;
  height?: number;
}

interface CustomTooltipPayload {
  date: string;
  totalCents: number;
  currency: string;
}

function CustomTooltip({
  active,
  payload,
}: TooltipProps<number, string> & { payload?: Array<{ payload?: CustomTooltipPayload }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0].payload as CustomTooltipPayload;
  const { date, totalCents, currency } = entry;
  const formatted = formatMoney(totalCents, currency);

  return (
    <div style={tooltipStyle}>
      <div className="font-medium text-gray-50 mb-1">{date}</div>
      <div className="text-gray-300 text-xs">{formatted}</div>
    </div>
  );
}

export function DailyTrendChart({
  data,
  currency,
  height = 200,
}: DailyTrendChartProps) {
  const safeData = data ?? [];
  const isEmpty = safeData.length === 0 || safeData.every((d) => d.totalCents === 0);

  if (isEmpty) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 text-slate-500"
        style={{ height }}
      >
        <TrendingUp className="w-10 h-10 opacity-30" />
        <p className="text-sm">No spending data for the last 30 days</p>
      </div>
    );
  }

  // Attach currency to each data entry so the tooltip can access it
  const chartData = safeData.map((d) => ({ ...d, currency }));

  const tealColor = CHART_COLORS[0]; // "#14b8a6"

  return (
    <div className="overflow-hidden">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id="dailyTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={tealColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={tealColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            interval="preserveStartEnd"
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
            cursor={{ stroke: "rgba(148, 163, 184, 0.2)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="totalCents"
            stroke={tealColor}
            strokeWidth={2}
            fill="url(#dailyTrendGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
