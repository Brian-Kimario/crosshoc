import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface GroupDeletedEmailProps {
  name: string;
  groupName: string;
  reason: string;
  supportEmail: string;
}

export function GroupDeletedEmail({
  name,
  groupName,
  reason,
  supportEmail,
}: GroupDeletedEmailProps) {
  return (
    <EmailLayout previewText="A SplitEasy group you were in has been deleted">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        A group you were in has been deleted
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
        An administrator has permanently deleted the group{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{groupName}</span>
        . All associated expenses and settlements have been removed.
      </Text>

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

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        {reason}
      </Text>

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
        If you believe this action was taken in error, please contact our
        support team within 30 days. Include your account email address and the
        group name in your message.
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

export default GroupDeletedEmail;
