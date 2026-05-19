"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from "recharts";
import { Users } from "lucide-react";
import { CHART_COLORS, tooltipStyle } from "@/lib/chart-theme";
import { formatMoney } from "@/lib/money-utils";

interface MemberContributionChartProps {
  data: Array<{ userId: string; name: string; paidCents: number; owedCents: number }>;
  currency: string;
  currentUserId: string;
}

interface ChartEntry {
  userId: string;
  name: string;
  paidCents: number;
  owedCents: number;
  currency: string;
  isCurrentUser: boolean;
}

interface CustomTooltipPayload {
  name: string;
  paidCents: number;
  owedCents: number;
  currency: string;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload?: CustomTooltipPayload }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0].payload as CustomTooltipPayload;
  const { name, paidCents, owedCents, currency } = entry;

  return (
    <div style={tooltipStyle}>
      <div className="font-medium text-gray-50 mb-1.5">{name}</div>
      <div className="flex items-center gap-2 text-xs text-gray-300 mb-0.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: CHART_COLORS[0] }}
        />
        <span>Paid: {formatMoney(paidCents, currency)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-300">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: CHART_COLORS[2] }}
        />
        <span>Owed: {formatMoney(owedCents, currency)}</span>
      </div>
    </div>
  );
}

export function MemberContributionChart({
  data,
  currency,
  currentUserId,
}: MemberContributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-slate-500 h-48">
        <Users className="w-10 h-10 opacity-30" />
        <p className="text-sm">No member data for this period</p>
      </div>
    );
  }

  // Sort by paidCents descending, cap at 8 members
  const chartData: ChartEntry[] = data
    .slice()
    .sort((a, b) => b.paidCents - a.paidCents)
    .slice(0, 8)
    .map((d) => ({
      ...d,
      currency,
      isCurrentUser: d.userId === currentUserId,
    }));

  // Dynamic height: 56px per member row + margins
  const chartHeight = Math.max(200, chartData.length * 56 + 16);

  return (
    <div className="overflow-hidden">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            tickFormatter={(value: number) =>
              formatMoney(value, currency, { showSymbol: true })
            }
            width={60}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={({ x, y, payload }: { x: number | string; y: number | string; payload: { value: string } }) => {
              const entry = chartData.find((d) => d.name === payload.value);
              const isCurrentUser = entry?.isCurrentUser ?? false;
              return (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  fill={isCurrentUser ? CHART_COLORS[0] : "#94a3b8"}
                  fontSize={12}
                  fontWeight={isCurrentUser ? 600 : 400}
                >
                  {payload.value}
                </text>
              );
            }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          />
          {/* Paid bar */}
          <Bar dataKey="paidCents" name="Paid" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={`paid-${entry.userId}`}
                fill={CHART_COLORS[0]}
                opacity={entry.isCurrentUser ? 1 : 0.75}
                stroke={entry.isCurrentUser ? CHART_COLORS[0] : "none"}
                strokeWidth={entry.isCurrentUser ? 1.5 : 0}
              />
            ))}
          </Bar>
          {/* Owed bar */}
          <Bar dataKey="owedCents" name="Owed" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={`owed-${entry.userId}`}
                fill={CHART_COLORS[2]}
                opacity={entry.isCurrentUser ? 1 : 0.75}
                stroke={entry.isCurrentUser ? CHART_COLORS[2] : "none"}
                strokeWidth={entry.isCurrentUser ? 1.5 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex gap-4 justify-center px-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: CHART_COLORS[0] }}
          />
          <span>Paid</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: CHART_COLORS[2] }}
          />
          <span>Owed</span>
        </div>
      </div>
    </div>
  );
}
