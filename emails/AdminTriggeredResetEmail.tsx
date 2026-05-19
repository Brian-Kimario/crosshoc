import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface AdminTriggeredResetEmailProps {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  supportEmail: string;
}

export function AdminTriggeredResetEmail({
  name,
  resetUrl,
  expiresInMinutes,
  supportEmail,
}: AdminTriggeredResetEmailProps) {
  return (
    <EmailLayout previewText="An admin has initiated a password reset for your account">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Admin-initiated password reset
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
        An administrator has initiated a password reset for your SplitEasy
        account. Use the button below to set a new password.
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
        This link expires in {expiresInMinutes} minutes. If you do not reset
        your password before it expires, you will need to contact support to
        request a new link.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you have questions or did not expect this email, please contact our
        support team at{" "}
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

export default AdminTriggeredResetEmail;
