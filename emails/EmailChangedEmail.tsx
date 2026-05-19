import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface EmailChangedEmailProps {
  name: string;
  oldEmail: string;
  newEmail: string;
  supportEmail: string;
}

export function EmailChangedEmail({
  name,
  oldEmail,
  newEmail,
  supportEmail,
}: EmailChangedEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy email address has been changed">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your email address has been changed
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
        The email address associated with your SplitEasy account has been
        updated.
      </Text>

      <Text
        style={{
          fontSize: "14px",
          color: "#64748B",
          margin: "0 0 8px 0",
        }}
      >
        Previous email address:
      </Text>
      <Text
        style={{
          fontSize: "16px",
          color: "#F1F5F9",
          fontWeight: "600",
          margin: "0 0 16px 0",
        }}
      >
        {oldEmail}
      </Text>

      <Text
        style={{
          fontSize: "14px",
          color: "#64748B",
          margin: "0 0 8px 0",
        }}
      >
        New email address:
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
          color: "#F87171",
          lineHeight: "1.6",
          margin: "0 0 8px 0",
          fontWeight: "600",
        }}
      >
        Didn&apos;t authorise this change?
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you did not request this change, please contact our support team
        immediately at{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: "#10B981", textDecoration: "none" }}
        >
          {supportEmail}
        </Link>
        . We can help you recover your account.
      </Text>
    </EmailLayout>
  );
}

export default EmailChangedEmail;
