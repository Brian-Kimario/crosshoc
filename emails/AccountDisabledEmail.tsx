import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface AccountDisabledEmailProps {
  name: string;
  reason?: string;
  supportEmail: string;
}

export function AccountDisabledEmail({
  name,
  reason,
  supportEmail,
}: AccountDisabledEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy account has been disabled">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your account has been disabled
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
        Your SplitEasy account has been disabled by an administrator. You will
        not be able to log in while your account is disabled.
      </Text>

      {reason && (
        <Text
          style={{
            fontSize: "16px",
            color: "#94A3B8",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
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
          {reason}
        </Text>
      )}

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
        If you believe this action was taken in error, you can appeal by
        contacting our support team. Please include your account email address
        and any relevant context in your message.
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

export default AccountDisabledEmail;
