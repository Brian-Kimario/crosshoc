import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface VerifyEmailChangeEmailProps {
  name: string;
  verifyUrl: string;
  newEmail: string;
  expiresInHours: number;
}

export function VerifyEmailChangeEmail({
  name,
  verifyUrl,
  newEmail,
  expiresInHours,
}: VerifyEmailChangeEmailProps) {
  return (
    <EmailLayout previewText="Verify your new SplitEasy email address">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Verify your new email address
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
          margin: "0 0 8px 0",
        }}
      >
        You requested to change your SplitEasy email address to:
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#10B981",
          fontWeight: "600",
          margin: "0 0 24px 0",
        }}
      >
        {newEmail}
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        Click the button below to confirm this change. You will be signed out of
        all devices after verification.
      </Text>

      <Button
        href={verifyUrl}
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
        Verify Email Address
      </Button>

      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "12px 0 24px 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={verifyUrl} style={{ color: "#10B981" }}>
          {verifyUrl}
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
        This link expires in {expiresInHours} hour{expiresInHours !== 1 ? "s" : ""}.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you did not request this change, you can safely ignore this email.
        Your current email address will remain unchanged.
      </Text>
    </EmailLayout>
  );
}

export default VerifyEmailChangeEmail;
