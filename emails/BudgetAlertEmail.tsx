import { Button, Link, Section, Text } from "@react-email/components";
import { formatMoney } from "@/lib/money-utils";
import { EmailLayout } from "./components/EmailLayout";

// Task 1.1: Props interface with all required fields
export interface BudgetAlertEmailProps {
  name: string;           // Member name
  groupName: string;      // Group name
  groupUrl: string;       // Link to group page
  currentSpentCents: number;  // Current spending in cents
  budgetLimitCents: number;   // Budget limit in cents
  percentUsed: number;    // Percentage of budget used (0-100+)
  currency: string;       // Currency code (USD, INR, etc.)
  isOverBudget: boolean;  // true if percentUsed >= 100
}

// Task 1.4: Progress bar — cap visual width at 100%, apply conditional color
function ProgressBar({
  percentUsed,
  isOverBudget,
}: {
  percentUsed: number;
  isOverBudget: boolean;
}) {
  const progressBarWidth = Math.min(percentUsed, 100); // Cap at 100% for visual
  const progressBarColor = isOverBudget ? "#EF4444" : "#F59E0B"; // Red or amber
  const trackColor = "#1E293B";

  return (
    <Section style={{ margin: "0 0 8px 0" }}>
      {/* Track */}
      <div
        style={{
          backgroundColor: trackColor,
          borderRadius: "6px",
          height: "12px",
          width: "100%",
          overflow: "hidden",
        }}
      >
        {/* Fill */}
        <div
          style={{
            backgroundColor: progressBarColor,
            borderRadius: "6px",
            height: "12px",
            width: `${progressBarWidth}%`,
          }}
        />
      </div>
    </Section>
  );
}

// Task 1.1 + 1.2 + 1.3 + 1.4 + 1.5: Full component
export function BudgetAlertEmail({
  name,
  groupName,
  groupUrl,
  currentSpentCents,
  budgetLimitCents,
  percentUsed,
  currency,
  isOverBudget,
}: BudgetAlertEmailProps) {
  // Task 1.3: Format money values using the shared utility
  const formattedSpent = formatMoney(currentSpentCents, currency);
  const formattedLimit = formatMoney(budgetLimitCents, currency);
  const formattedPercent = `${Math.round(percentUsed)}%`;

  // Task 1.2: Conditional heading and accent color
  const accentColor = isOverBudget ? "#EF4444" : "#F59E0B";
  const headingText = isOverBudget
    ? `${groupName} has exceeded its budget`
    : `${groupName} is approaching its budget limit`;
  const subText = isOverBudget
    ? "Your group has gone over its spending limit. Review expenses and take action to get back on track."
    : "Your group is getting close to its spending limit. Keep an eye on expenses to stay within budget.";

  return (
    // Task 1.2: Use EmailLayout for consistent styling
    <EmailLayout previewText={`Budget alert for ${groupName}`}>
      {/* Task 1.2: Heading with conditional message */}
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: accentColor,
          margin: "0 0 16px 0",
        }}
      >
        {isOverBudget ? "⚠ Over Budget" : "⚠ Budget Alert"}
      </Text>

      <Text
        style={{
          fontSize: "20px",
          fontWeight: "600",
          color: "#F1F5F9",
          margin: "0 0 8px 0",
        }}
      >
        {headingText}
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 16px 0",
        }}
      >
        Hi {name},
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 28px 0",
        }}
      >
        {subText}
      </Text>

      {/* Task 1.3: Spending summary section */}
      <Section
        style={{
          backgroundColor: "#1E293B",
          borderRadius: "8px",
          padding: "20px",
          margin: "0 0 24px 0",
        }}
      >
        <Text
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#64748B",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "0 0 16px 0",
          }}
        >
          Spending Summary
        </Text>

        {/* Current spending row */}
        <Section style={{ margin: "0 0 8px 0" }}>
          <Text
            style={{
              fontSize: "14px",
              color: "#94A3B8",
              margin: "0 0 2px 0",
            }}
          >
            Current Spending
          </Text>
          <Text
            style={{
              fontSize: "22px",
              fontWeight: "700",
              color: accentColor,
              margin: "0",
            }}
          >
            {formattedSpent}
          </Text>
        </Section>

        {/* Budget limit row */}
        <Section style={{ margin: "0 0 16px 0" }}>
          <Text
            style={{
              fontSize: "14px",
              color: "#94A3B8",
              margin: "0 0 2px 0",
            }}
          >
            Budget Limit
          </Text>
          <Text
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#CBD5E1",
              margin: "0",
            }}
          >
            {formattedLimit}
          </Text>
        </Section>

        {/* Task 1.4: Progress bar */}
        <ProgressBar percentUsed={percentUsed} isOverBudget={isOverBudget} />

        {/* Percentage label */}
        <Text
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: accentColor,
            margin: "6px 0 0 0",
            textAlign: "right",
          }}
        >
          {formattedPercent} used
        </Text>
      </Section>

      {/* Task 1.5: Call-to-action button */}
      <Button
        href={groupUrl}
        style={{
          backgroundColor: "#10B981",
          color: "#FFFFFF",
          fontSize: "16px",
          fontWeight: "600",
          padding: "12px 24px",
          borderRadius: "8px",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        View Group
      </Button>

      {/* Task 1.5: Fallback link for email clients that don't support buttons */}
      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "12px 0 0 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={groupUrl} style={{ color: "#10B981" }}>
          {groupUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

// Task 1.1: Both named (above) and default export for consistency
export default BudgetAlertEmail;
