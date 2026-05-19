import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface InviteExpiringSoonEmailProps {
  name: string;
  groupName: string;
  hoursRemaining: number;
  groupUrl: string;
}

export function InviteExpiringSoonEmail({
  name,
  groupName,
  hoursRemaining,
  groupUrl,
}: InviteExpiringSoonEmailProps) {
  return (
    <EmailLayout previewText="Your SplitEasy group invite is expiring soon">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        Your group invite is expiring soon
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
        The invite link for your group{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{groupName}</span>{" "}
        is expiring in{" "}
        <span style={{ color: "#F59E0B", fontWeight: "600" }}>
          {hoursRemaining} {hoursRemaining === 1 ? "hour" : "hours"}
        </span>
        . Once it expires, anyone with the current link will no longer be able
        to join.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        You can generate a new invite link from your group settings if needed.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        Go to{" "}
        <Link href={groupUrl} style={{ color: "#10B981", textDecoration: "none" }}>
          group settings
        </Link>{" "}
        to manage your invite link.
      </Text>

      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "8px 0 0 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={groupUrl} style={{ color: "#10B981" }}>
          {groupUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default InviteExpiringSoonEmail;
