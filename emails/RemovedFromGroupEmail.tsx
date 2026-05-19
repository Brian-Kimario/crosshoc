import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface RemovedFromGroupEmailProps {
  name: string;
  groupName: string;
  reason: string;
  supportEmail: string;
}

export function RemovedFromGroupEmail({
  name,
  groupName,
  reason,
  supportEmail,
}: RemovedFromGroupEmailProps) {
  return (
    <EmailLayout previewText="You have been removed from a SplitEasy group">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        You have been removed from a group
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
        An administrator has removed you from the group{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{groupName}</span>
        .
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
        support team. Include your account email address and the group name in
        your message.
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

export default RemovedFromGroupEmail;
