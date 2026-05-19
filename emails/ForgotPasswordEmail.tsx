import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface ForgotPasswordEmailProps {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function ForgotPasswordEmail({
  name,
  resetUrl,
  expiresInMinutes,
}: ForgotPasswordEmailProps) {
  return (
    <EmailLayout previewText="Reset your SplitEasy password">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Reset your password
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
        We received a request to reset the password for your SplitEasy account.
        Click the button below to choose a new password.
      </Text>

      <Button
        href={resetUrl}
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
        Reset Your Password
      </Button>

      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "12px 0 24px 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={resetUrl} style={{ color: "#10B981" }}>
          {resetUrl}
        </Link>
      </Text>

      <Text
        style={{
          fontSize: "14px",
          color: "#F59E0B",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        This link expires in {expiresInMinutes} minutes.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you did not request a password reset, you can safely ignore this
        email. Your password will not be changed.
      </Text>
    </EmailLayout>
  );
}

export default ForgotPasswordEmail;
