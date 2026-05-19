import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface AccountLockedEmailProps {
  name: string;
  lockDurationMinutes: number;
  forgotPasswordUrl: string;
}

export function AccountLockedEmail({
  name,
  lockDurationMinutes,
  forgotPasswordUrl,
}: AccountLockedEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy account has been temporarily locked">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your account has been temporarily locked
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
        Your SplitEasy account has been temporarily locked due to too many
        failed login attempts. This is a security measure to protect your
        account.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#F59E0B",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        Your account will be automatically unlocked in{" "}
        <strong>{lockDurationMinutes} minute{lockDurationMinutes !== 1 ? "s" : ""}</strong>.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        If you&apos;d like to regain access sooner, you can reset your password
        using the button below.
      </Text>

      <Button
        href={forgotPasswordUrl}
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
        <Link href={forgotPasswordUrl} style={{ color: "#10B981" }}>
          {forgotPasswordUrl}
        </Link>
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you did not attempt to log in, your account may be under attack. We
        recommend resetting your password immediately to secure your account.
      </Text>
    </EmailLayout>
  );
}

export default AccountLockedEmail;
