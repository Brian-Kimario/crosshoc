import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface ExpenseVoidedEmailProps {
  name: string;
  expenseDescription: string;
  amount: string;
  groupName: string;
  reason: string;
  supportEmail: string;
}

export function ExpenseVoidedEmail({
  name,
  expenseDescription,
  amount,
  groupName,
  reason,
  supportEmail,
}: ExpenseVoidedEmailProps) {
  return (
    <EmailLayout
      previewText={`An expense in ${groupName} has been voided`}
    >
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        An expense has been voided
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
          margin: "0 0 24px 0",
        }}
      >
        An administrator has voided an expense in the group{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{groupName}</span>
        .
      </Text>

      <Text
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#CBD5E1",
          margin: "0 0 4px 0",
        }}
      >
        Expense details:
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 4px 0",
        }}
      >
        Description:{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>
          {expenseDescription}
        </span>
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        Amount:{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{amount}</span>
      </Text>

      <Text
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#F59E0B",
          margin: "0 0 16px 0",
        }}
      >
        ⚠ This action is irreversible.
      </Text>

      <Text
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#CBD5E1",
          margin: "0 0 4px 0",
        }}
      >
        Reason provided:
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        {reason}
      </Text>

      <Text
        style={{
          fontSize: "16px",
          fontWeight: "600",
          color: "#CBD5E1",
          margin: "0 0 8px 0",
        }}
      >
        How to appeal
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        If you believe this action was taken in error, please contact our
        support team. Include your account email address, the group name, and
        the expense description in your message.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        Contact support at{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: "#10B981", textDecoration: "none" }}
        >
          {supportEmail}
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export default ExpenseVoidedEmail;
