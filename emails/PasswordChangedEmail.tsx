import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface PasswordChangedEmailProps {
  name: string;
  settingsUrl: string;
  supportEmail: string;
}

export function PasswordChangedEmail({
  name,
  settingsUrl,
  supportEmail,
}: PasswordChangedEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy password has been changed">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your password has been changed
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
        This is a confirmation that the password for your SplitEasy account was
        recently changed.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        If you made this change, no further action is needed. You can review your
        account security settings at any time:
      </Text>

      <Text
        style={{
          fontSize: "14px",
          color: "#64748B",
          margin: "0 0 24px 0",
        }}
      >
        <Link href={settingsUrl} style={{ color: "#10B981" }}>
          {settingsUrl}
        </Link>
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#F87171",
          lineHeight: "1.6",
          margin: "0 0 8px 0",
          fontWeight: "600",
        }}
      >
        Didn&apos;t make this change?
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you did not change your password, your account may be compromised.
        Please contact our support team immediately at{" "}
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

export default PasswordChangedEmail;
