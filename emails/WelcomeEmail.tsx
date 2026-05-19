import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface WelcomeEmailProps {
  name: string;
  dashboardUrl: string;
}

export function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText={`Welcome to SplitEasy, ${name}!`}>
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Welcome to SplitEasy, {name}!
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        We&apos;re glad you&apos;re here. SplitEasy makes it easy to track shared
        expenses and settle up with friends, family, or housemates — without the
        awkward conversations.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 32px 0",
        }}
      >
        Head to your dashboard to create your first group and start splitting
        expenses.
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

export default WelcomeEmail;
