import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface AccountDeletedEmailProps {
  name: string;
  reason?: string;
  supportEmail: string;
}

export function AccountDeletedEmail({
  name,
  reason,
  supportEmail,
}: AccountDeletedEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy account has been deleted">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your account has been deleted
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
        Your SplitEasy account has been permanently deleted by an administrator.
        All associated data, including your groups, expenses, and settlements,
        has been removed and cannot be recovered.
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
        30-day appeal window
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        If you believe this action was taken in error, you have{" "}
        <strong style={{ color: "#CBD5E1" }}>30 days</strong> from the date of
        this email to submit an appeal. After this window, account recovery will
        no longer be possible.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        To appeal, contact our support team at{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: "#10B981", textDecoration: "none" }}
        >
          {supportEmail}
        </Link>{" "}
        with your account email address and any relevant context.
      </Text>
    </EmailLayout>
  );
}

export default AccountDeletedEmail;
