import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface AccountReEnabledEmailProps {
  name: string;
  dashboardUrl: string;
}

export function AccountReEnabledEmail({
  name,
  dashboardUrl,
}: AccountReEnabledEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy account has been re-enabled">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your account has been re-enabled
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
        Great news — your SplitEasy account has been re-enabled. You now have
        full access to your groups, expenses, and settlements again.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 32px 0",
        }}
      >
        Head back to your dashboard to pick up where you left off.
      </Text>

      <Button
        href={dashboardUrl}
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
        Go to Dashboard
      </Button>

      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "12px 0 0 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={dashboardUrl} style={{ color: "#10B981" }}>
          {dashboardUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default AccountReEnabledEmail;
